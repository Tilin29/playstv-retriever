import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, type ActionCtx } from './_generated/server'
import {
  cdnHostVariants,
  clipMediaPrefix,
  parseProfilePage,
  pickFullVideo,
  processedFileName,
  profilePagePriority,
  type ParsedClip,
} from './model/playstv'
import { deleteFiles } from './model/profiles'
import {
  fetchArchivedFile,
  fetchCaptureHtml,
  listCaptures,
  rawCaptureUrl,
  sleep,
  type Snapshot,
} from './model/wayback'
import { clipFields } from './schema'

// Clip recovery is spread out so a large profile doesn't hammer the Archive.
const CLIP_RECOVERY_SPACING_MS = 1_500
const MAX_PROFILE_PAGES = 2
const EMPTY_LISTING_RETRIES = 2
const EMPTY_LISTING_RETRY_DELAY_MS = 3_000

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** Finds the user's archived profile pages, scrapes the clip list and stores it. */
export const retrieveProfile = internalAction({
  args: { profileId: v.id('profiles'), username: v.string() },
  handler: async (ctx, { profileId, username }) => {
    try {
      const pages = (await listCaptures(`plays.tv/u/${username}`))
        .map((snapshot) => ({ snapshot, priority: profilePagePriority(snapshot.url, username) }))
        .filter((page): page is { snapshot: Snapshot; priority: number } => page.priority !== null)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, MAX_PROFILE_PAGES)

      // Clips are merged across pages; the best-ranked page supplies name and avatar.
      let primary: { snapshot: Snapshot; displayName: string | null; avatarUrl: string | null } | null =
        null
      const clips = new Map<string, ParsedClip>()
      for (const { snapshot } of pages) {
        const html = await fetchCaptureHtml(snapshot)
        if (!html) continue
        const parsed = parseProfilePage(html)
        primary ??= { snapshot, displayName: parsed.displayName, avatarUrl: parsed.avatarUrl }
        for (const clip of parsed.clips) {
          if (!clips.has(clip.videoId)) clips.set(clip.videoId, clip)
        }
      }

      if (!primary) {
        await ctx.runMutation(internal.retrieval.markNotFound, { profileId })
        return null
      }

      let avatarStorageId: Id<'_storage'> | undefined
      if (primary.avatarUrl) {
        try {
          const avatar = await fetchArchivedFile(primary.snapshot.timestamp, primary.avatarUrl)
          if (avatar) avatarStorageId = await ctx.storage.store(avatar)
        } catch {
          // The avatar is optional; carry on without it.
        }
      }

      await ctx.runMutation(internal.retrieval.saveProfile, {
        profileId,
        username: primary.displayName ?? username,
        snapshotTimestamp: primary.snapshot.timestamp,
        snapshotUrl: primary.snapshot.url,
        avatarStorageId,
        clips: [...clips.values()],
      })
    } catch (error) {
      await ctx.runMutation(internal.retrieval.markFailed, {
        profileId,
        error: errorMessage(error),
      })
    }
    return null
  },
})

export const saveProfile = internalMutation({
  args: {
    profileId: v.id('profiles'),
    username: v.string(),
    snapshotTimestamp: v.string(),
    snapshotUrl: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    clips: v.array(v.object(clipFields)),
  },
  handler: async (ctx, { profileId, clips, ...profile }) => {
    if (!(await ctx.db.get('profiles', profileId))) {
      await deleteFiles(ctx, [profile.avatarStorageId])
      return null
    }
    await ctx.db.patch('profiles', profileId, { ...profile, status: 'ready' })

    for (const [index, clip] of clips.entries()) {
      const clipId = await ctx.db.insert('clips', {
        ...clip,
        profileId,
        mediaStatus: 'pending',
        videoStatus: 'checking',
      })
      await ctx.scheduler.runAfter(index * CLIP_RECOVERY_SPACING_MS, internal.retrieval.recoverClip, {
        clipId,
        cdnHost: clip.cdnHost,
        mediaId: clip.mediaId,
      })
    }
    return null
  },
})

export const markNotFound = internalMutation({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    if (await ctx.db.get('profiles', profileId)) {
      await ctx.db.patch('profiles', profileId, { status: 'not_found' })
    }
    return null
  },
})

export const markFailed = internalMutation({
  args: { profileId: v.id('profiles'), error: v.string() },
  handler: async (ctx, { profileId, error }) => {
    if (await ctx.db.get('profiles', profileId)) {
      await ctx.db.patch('profiles', profileId, { status: 'error', error })
    }
    return null
  },
})

/** Lists a clip's archived files by name ("720.mp4", "preview_144.mp4", ...). */
async function listClipFiles(cdnHost: string, mediaId: string) {
  const files = new Map<string, Snapshot>()
  for (const host of cdnHostVariants(cdnHost)) {
    let captures: Snapshot[] = []
    for (let attempt = 0; ; attempt++) {
      captures = await listCaptures(clipMediaPrefix(host, mediaId))
      // The Archive occasionally answers with an empty listing during hiccups, so a
      // clip's own host is re-checked before concluding nothing was saved.
      if (captures.length > 0 || host !== cdnHost || attempt >= EMPTY_LISTING_RETRIES) break
      await sleep(EMPTY_LISTING_RETRY_DELAY_MS)
    }
    for (const capture of captures) {
      const fileName = processedFileName(capture.url)
      if (fileName && !files.has(fileName)) files.set(fileName, capture)
    }
    if (pickFullVideo(files.keys())) break
  }
  return files
}

/** Downloads the first of `fileNames` that was archived into storage. */
async function storeFirstArchived(
  ctx: ActionCtx,
  files: Map<string, Snapshot>,
  fileNames: string[],
) {
  for (const fileName of fileNames) {
    const capture = files.get(fileName)
    if (!capture) continue
    const blob = await fetchArchivedFile(capture.timestamp, capture.url)
    if (blob) return await ctx.storage.store(blob)
  }
  return undefined
}

/**
 * Checks which of a clip's files the Archive saved: records a link to the best
 * full-length video, and stores the hover preview and thumbnail.
 */
export const recoverClip = internalAction({
  args: {
    clipId: v.id('clips'),
    cdnHost: v.string(),
    mediaId: v.string(),
  },
  handler: async (ctx, { clipId, cdnHost, mediaId }) => {
    let files: Map<string, Snapshot>
    try {
      files = await listClipFiles(cdnHost, mediaId)
    } catch {
      await ctx.runMutation(internal.retrieval.markClipRecoveryFailed, { clipId })
      return null
    }

    const fullVideo = pickFullVideo(files.keys())
    const videoCapture = fullVideo ? files.get(fullVideo.fileName) : undefined

    let previewStorageId: Id<'_storage'> | undefined
    let thumbnailStorageId: Id<'_storage'> | undefined
    let mediaFailed = false
    try {
      previewStorageId = await storeFirstArchived(ctx, files, ['preview_144.mp4'])
      thumbnailStorageId = await storeFirstArchived(ctx, files, ['480.jpg', '144.jpg'])
    } catch {
      mediaFailed = true
    }

    await ctx.runMutation(internal.retrieval.saveClipRecovery, {
      clipId,
      previewStorageId,
      thumbnailStorageId,
      mediaStatus:
        previewStorageId || thumbnailStorageId ? 'stored' : mediaFailed ? 'failed' : 'missing',
      videoStatus: videoCapture ? 'available' : 'unavailable',
      videoUrl: videoCapture ? rawCaptureUrl(videoCapture.timestamp, videoCapture.url) : undefined,
      videoQuality: fullVideo?.quality,
    })
    return null
  },
})

export const saveClipRecovery = internalMutation({
  args: {
    clipId: v.id('clips'),
    previewStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
    mediaStatus: v.union(v.literal('stored'), v.literal('missing'), v.literal('failed')),
    videoStatus: v.union(v.literal('available'), v.literal('unavailable')),
    videoUrl: v.optional(v.string()),
    videoQuality: v.optional(v.number()),
  },
  handler: async (ctx, { clipId, ...recovery }) => {
    // The profile may have been cleaned up while recovery was running.
    if (!(await ctx.db.get('clips', clipId))) {
      await deleteFiles(ctx, [recovery.previewStorageId, recovery.thumbnailStorageId])
      return null
    }
    await ctx.db.patch('clips', clipId, recovery)
    return null
  },
})

export const markClipRecoveryFailed = internalMutation({
  args: { clipId: v.id('clips') },
  handler: async (ctx, { clipId }) => {
    if (await ctx.db.get('clips', clipId)) {
      await ctx.db.patch('clips', clipId, { mediaStatus: 'failed', videoStatus: 'failed' })
    }
    return null
  },
})
