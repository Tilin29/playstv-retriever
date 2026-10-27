import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from './_generated/server'
import {
  cdnHostVariants,
  clipMediaPrefix,
  clipMediaUrl,
  parseProfilePage,
  parseVideosModulePage,
  pickFullVideo,
  processedFileName,
  profilePagePriority,
  videosModuleUrl,
  type ParsedClip,
  type VideosModuleConfig,
} from './model/playstv'
import { deleteFiles } from './model/profiles'
import {
  fetchArchivedFile,
  fetchCaptureHtml,
  listCaptures,
  rawCaptureUrl,
  type Snapshot,
} from './model/wayback'
import { clipFields } from './schema'

const MAX_PROFILE_PAGES = 2
const MAX_VIDEOS_MODULE_PAGES = 100
// Previews are plain file downloads, so a few run in parallel.
const MEDIA_DOWNLOAD_CONCURRENCY = 4
// Each file listing spends most of its 10-30s waiting on the Archive, so a few run
// at once; a rate-limit response pauses all of them (see model/wayback.ts).
const VIDEO_CHECK_CONCURRENCY = 3
// Each phase hands over to a fresh action before running into the action time limit.
const PHASE_TIME_BUDGET_MS = 4 * 60 * 1000
const PHASE_BATCH_SIZE = 20
// Video checks the Archive errored on get another pass after these delays.
const VIDEO_CHECK_RETRY_DELAYS_MS = [30_000, 120_000]
// Only full-length MP4s ("720.mp4", ...) matter when listing a clip's files.
const FULL_VIDEO_URL_PATTERN = '.*/processed/[0-9]+\\.mp4'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** Runs `fn` over `items` with at most `limit` in flight, starting none after `deadline`. */
async function forEachConcurrently<T>(
  items: T[],
  limit: number,
  deadline: number,
  fn: (item: T) => Promise<void>,
) {
  let next = 0
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
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
      let nextVideosPage: { snapshot: Snapshot; config: VideosModuleConfig } | null = null
      const clips = new Map<string, ParsedClip>()
      const addClips = (parsed: ParsedClip[]) => {
        for (const clip of parsed) {
          if (!clips.has(clip.videoId)) clips.set(clip.videoId, clip)
        }
      }
      for (const { snapshot } of pages) {
        const html = await fetchCaptureHtml(snapshot)
        if (!html) continue
        const parsed = parseProfilePage(html)
        primary ??= { snapshot, displayName: parsed.displayName, avatarUrl: parsed.avatarUrl }
        if (parsed.nextVideosPage) nextVideosPage ??= { snapshot, config: parsed.nextVideosPage }
        addClips(parsed.clips)
      }

      if (!primary) {
        await ctx.runMutation(internal.retrieval.markNotFound, { profileId })
        return null
      }

      // Profile pages only show the newest clips; older ones came from "load more"
      // requests, which the Archive captured separately. Follow them until they run out.
      let clipListIncomplete = false
      for (let page = 0; nextVideosPage && page < MAX_VIDEOS_MODULE_PAGES; page++) {
        const { snapshot, config } = nextVideosPage
        let json: string | null
        try {
          json = await fetchCaptureHtml({ timestamp: snapshot.timestamp, url: videosModuleUrl(config) })
        } catch {
          clipListIncomplete = true
          break
        }
        if (!json) break
        const parsed = parseVideosModulePage(json)
        addClips(parsed.clips)
        nextVideosPage = parsed.nextVideosPage ? { snapshot, config: parsed.nextVideosPage } : null
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
        clipListIncomplete,
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
    clipListIncomplete: v.boolean(),
    clips: v.array(v.object(clipFields)),
  },
  handler: async (ctx, { profileId, clips, ...profile }) => {
    if (!(await ctx.db.get('profiles', profileId))) {
      await deleteFiles(ctx, [profile.avatarStorageId])
      return null
    }
    await ctx.db.patch('profiles', profileId, { ...profile, status: 'ready' })

    for (const clip of clips) {
      await ctx.db.insert('clips', {
        ...clip,
        profileId,
        mediaStatus: 'pending',
        videoStatus: 'checking',
      })
    }
    // The clips are visible right away (their previews play from the Wayback Machine).
    // Both phases run side by side: they use different Archive endpoints.
    await ctx.scheduler.runAfter(0, internal.retrieval.downloadProfileMedia, {
      profileId,
      timestamp: profile.snapshotTimestamp,
    })
    await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, { profileId })
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

// ---------------------------------------------------------------------------
// Phase 1: store copies of every clip's hover preview and thumbnail.
// ---------------------------------------------------------------------------

export const listClipsNeedingMedia = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    return await ctx.db
      .query('clips')
      .withIndex('by_profileId_and_mediaStatus', (q) =>
        q.eq('profileId', profileId).eq('mediaStatus', 'pending'),
      )
      .take(PHASE_BATCH_SIZE)
  },
})

export const downloadProfileMedia = internalAction({
  args: { profileId: v.id('profiles'), timestamp: v.string() },
  handler: async (ctx, { profileId, timestamp }) => {
    const deadline = Date.now() + PHASE_TIME_BUDGET_MS
    for (;;) {
      const clips: Doc<'clips'>[] = await ctx.runQuery(internal.retrieval.listClipsNeedingMedia, {
        profileId,
      })
      if (clips.length === 0) break

      await forEachConcurrently(clips, MEDIA_DOWNLOAD_CONCURRENCY, deadline, (clip) =>
        storeClipMedia(ctx, clip, timestamp),
      )

      if (Date.now() > deadline) {
        await ctx.scheduler.runAfter(0, internal.retrieval.downloadProfileMedia, {
          profileId,
          timestamp,
        })
        return null
      }
    }
    return null
  },
})

/** Downloads the first of `urls` that was archived into storage. */
async function storeFirstArchived(ctx: ActionCtx, timestamp: string, urls: string[]) {
  for (const url of urls) {
    const blob = await fetchArchivedFile(timestamp, url)
    if (blob) return await ctx.storage.store(blob)
  }
  return undefined
}

async function storeClipMedia(ctx: ActionCtx, clip: Doc<'clips'>, timestamp: string) {
  let previewStorageId: Id<'_storage'> | undefined
  let thumbnailStorageId: Id<'_storage'> | undefined
  let failed = false
  try {
    previewStorageId = await storeFirstArchived(ctx, timestamp, [
      clipMediaUrl(clip, 'preview_144.mp4'),
    ])
    thumbnailStorageId = await storeFirstArchived(ctx, timestamp, [
      clipMediaUrl(clip, '480.jpg'),
      clipMediaUrl(clip, '144.jpg'),
    ])
  } catch {
    failed = true
  }
  await ctx.runMutation(internal.retrieval.saveClipMedia, {
    clipId: clip._id,
    previewStorageId,
    thumbnailStorageId,
    mediaStatus: previewStorageId || thumbnailStorageId ? 'stored' : failed ? 'failed' : 'missing',
  })
}

export const saveClipMedia = internalMutation({
  args: {
    clipId: v.id('clips'),
    previewStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
    mediaStatus: v.union(v.literal('stored'), v.literal('missing'), v.literal('failed')),
  },
  handler: async (ctx, { clipId, ...media }) => {
    // The profile may have been cleaned up while the download was running.
    if (!(await ctx.db.get('clips', clipId))) {
      await deleteFiles(ctx, [media.previewStorageId, media.thumbnailStorageId])
      return null
    }
    await ctx.db.patch('clips', clipId, media)
    return null
  },
})

// ---------------------------------------------------------------------------
// Phase 2: check which clips have a full-length video in the Archive.
// ---------------------------------------------------------------------------

export const listClipsNeedingVideoCheck = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    return await ctx.db
      .query('clips')
      .withIndex('by_profileId_and_videoStatus', (q) =>
        q.eq('profileId', profileId).eq('videoStatus', 'checking'),
      )
      .take(PHASE_BATCH_SIZE)
  },
})

export const checkProfileVideos = internalAction({
  args: { profileId: v.id('profiles'), attempt: v.optional(v.number()) },
  handler: async (ctx, { profileId, attempt = 0 }) => {
    const deadline = Date.now() + PHASE_TIME_BUDGET_MS
    for (;;) {
      const clips: Doc<'clips'>[] = await ctx.runQuery(
        internal.retrieval.listClipsNeedingVideoCheck,
        { profileId },
      )
      if (clips.length === 0) break

      await forEachConcurrently(clips, VIDEO_CHECK_CONCURRENCY, deadline, (clip) =>
        checkClipVideo(ctx, clip, attempt),
      )

      if (Date.now() > deadline) {
        await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, {
          profileId,
          attempt,
        })
        return null
      }
    }

    const retryDelay = VIDEO_CHECK_RETRY_DELAYS_MS[attempt]
    if (retryDelay !== undefined) {
      const requeued: number = await ctx.runMutation(internal.retrieval.requeueFailedVideoChecks, {
        profileId,
      })
      if (requeued > 0) {
        await ctx.scheduler.runAfter(retryDelay, internal.retrieval.checkProfileVideos, {
          profileId,
          attempt: attempt + 1,
        })
      }
    }
    return null
  },
})

/** Lists a clip's archived full-length videos by name ("720.mp4", "480.mp4", ...). */
async function listClipVideos(cdnHost: string, mediaId: string) {
  const files = new Map<string, Snapshot>()
  for (const host of cdnHostVariants(cdnHost)) {
    const captures = await listCaptures(clipMediaPrefix(host, mediaId), FULL_VIDEO_URL_PATTERN)
    for (const capture of captures) {
      const fileName = processedFileName(capture.url)
      if (fileName && !files.has(fileName)) files.set(fileName, capture)
    }
    if (pickFullVideo(files.keys())) break
  }
  return files
}

async function checkClipVideo(ctx: ActionCtx, clip: Doc<'clips'>, attempt: number) {
  let files: Map<string, Snapshot>
  try {
    files = await listClipVideos(clip.cdnHost, clip.mediaId)
  } catch {
    await ctx.runMutation(internal.retrieval.saveClipVideo, {
      clipId: clip._id,
      videoStatus: 'failed',
    })
    return
  }
  const fullVideo = pickFullVideo(files.keys())
  const videoCapture = fullVideo ? files.get(fullVideo.fileName) : undefined
  // The Archive occasionally answers with an empty listing during hiccups, so a clip
  // without a video is looked up once more in the delayed retry pass before giving up.
  const notFound = attempt === 0 ? 'rechecking' : 'unavailable'
  await ctx.runMutation(internal.retrieval.saveClipVideo, {
    clipId: clip._id,
    videoStatus: videoCapture ? 'available' : notFound,
    videoUrl: videoCapture ? rawCaptureUrl(videoCapture.timestamp, videoCapture.url) : undefined,
    videoQuality: fullVideo?.quality,
  })
}

export const saveClipVideo = internalMutation({
  args: {
    clipId: v.id('clips'),
    videoStatus: v.union(
      v.literal('available'),
      v.literal('unavailable'),
      v.literal('rechecking'),
      v.literal('failed'),
    ),
    videoUrl: v.optional(v.string()),
    videoQuality: v.optional(v.number()),
  },
  handler: async (ctx, { clipId, ...video }) => {
    if (await ctx.db.get('clips', clipId)) await ctx.db.patch('clips', clipId, video)
    return null
  },
})

/** Puts a profile's failed and to-be-rechecked video checks back in the queue; returns how many. */
export const requeueFailedVideoChecks = internalMutation({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    let requeued = 0
    for (const status of ['failed', 'rechecking'] as const) {
      const clips = await ctx.db
        .query('clips')
        .withIndex('by_profileId_and_videoStatus', (q) =>
          q.eq('profileId', profileId).eq('videoStatus', status),
        )
        .take(500)
      for (const clip of clips) await ctx.db.patch('clips', clip._id, { videoStatus: 'checking' })
      requeued += clips.length
    }
    return requeued
  },
})
