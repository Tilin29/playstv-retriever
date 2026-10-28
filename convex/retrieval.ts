import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from './_generated/server'
import { archiveGate } from './model/archive'
import { addGames, countRecoveredClip } from './model/games'
import {
  cdnHostVariants,
  clipMediaUrl,
  clipVideoUrl,
  FULL_VIDEO_QUALITIES,
  parseProfilePage,
  parseVideosModulePage,
  profilePagePriority,
  videosModuleUrl,
  type ParsedClip,
  type VideosModuleConfig,
} from './model/playstv'
import { deleteFiles } from './model/profiles'
import {
  fetchArchivedFile,
  fetchCaptureHtml,
  findCapture,
  listCaptures,
  rawCaptureUrl,
  type ArchiveGate,
  type Snapshot,
} from './model/wayback'
import { clipFields } from './schema'

const MAX_PROFILE_PAGES = 2
const MAX_VIDEOS_MODULE_PAGES = 100
// Requests mostly wait on the Archive, so a few run in parallel; the shared request
// budget in model/archive.ts decides how fast they actually go.
const MEDIA_DOWNLOAD_CONCURRENCY = 4
const VIDEO_CHECK_CONCURRENCY = 4
// Each phase hands over to a fresh action before running into the action time limit.
const PHASE_TIME_BUDGET_MS = 4 * 60 * 1000
const PHASE_BATCH_SIZE = 20
// Video probes ask for the capture closest to Plays.tv's shutdown.
const PLAYSTV_SHUTDOWN_TIMESTAMP = '20191215'

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

/**
 * Finds the user's archived profile pages and scrapes their clip list, following the
 * "load more" pages. Returns null when no profile page was archived.
 */
export async function scrapeProfile(gate: ArchiveGate, username: string) {
  const pages = (await listCaptures(gate, `plays.tv/u/${username}`))
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
      const existing = clips.get(clip.videoId)
      if (!existing) clips.set(clip.videoId, clip)
      // Another page's HTML list may name the game the first one left out.
      else if (clip.gameId && !existing.gameId) {
        clips.set(clip.videoId, { ...existing, gameId: clip.gameId, gameName: clip.gameName })
      }
    }
  }
  for (const { snapshot } of pages) {
    const html = await fetchCaptureHtml(gate, snapshot)
    if (!html) continue
    const parsed = parseProfilePage(html)
    primary ??= { snapshot, displayName: parsed.displayName, avatarUrl: parsed.avatarUrl }
    if (parsed.nextVideosPage) nextVideosPage ??= { snapshot, config: parsed.nextVideosPage }
    addClips(parsed.clips)
  }
  if (!primary) return null

  // Profile pages only show the newest clips; older ones came from "load more"
  // requests, which the Archive captured separately. Follow them until they run out.
  let clipListIncomplete = false
  for (let page = 0; nextVideosPage && page < MAX_VIDEOS_MODULE_PAGES; page++) {
    const { snapshot, config } = nextVideosPage
    let json: string | null
    try {
      json = await fetchCaptureHtml(gate, {
        timestamp: snapshot.timestamp,
        url: videosModuleUrl(config),
      })
    } catch {
      clipListIncomplete = true
      break
    }
    if (!json) break
    const parsed = parseVideosModulePage(json)
    addClips(parsed.clips)
    nextVideosPage = parsed.nextVideosPage ? { snapshot, config: parsed.nextVideosPage } : null
  }

  return { primary, clips: [...clips.values()], clipListIncomplete }
}

/** Finds the user's archived profile pages, scrapes the clip list and stores it. */
export const retrieveProfile = internalAction({
  args: { profileId: v.id('profiles'), username: v.string() },
  handler: async (ctx, { profileId, username }) => {
    const gate = archiveGate(ctx)
    try {
      const scraped = await scrapeProfile(gate, username)
      if (!scraped) {
        await ctx.runMutation(internal.retrieval.markNotFound, { profileId })
        return null
      }
      const { primary, clips, clipListIncomplete } = scraped

      let avatarStorageId: Id<'_storage'> | undefined
      if (primary.avatarUrl) {
        try {
          const avatar = await fetchArchivedFile(gate, primary.snapshot.timestamp, primary.avatarUrl)
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
        clips,
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
    await ctx.db.patch('profiles', profileId, {
      ...profile,
      status: 'ready',
      clipCount: clips.length,
      recoveredCount: 0,
    })

    for (const clip of clips) {
      await ctx.db.insert('clips', {
        ...clip,
        profileId,
        mediaStatus: 'pending',
        videoStatus: 'checking',
      })
    }
    await addGames(ctx, clips)
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
    const gate = archiveGate(ctx)
    const deadline = Date.now() + PHASE_TIME_BUDGET_MS
    for (;;) {
      const clips: Doc<'clips'>[] = await ctx.runQuery(internal.retrieval.listClipsNeedingMedia, {
        profileId,
      })
      if (clips.length === 0) break

      await forEachConcurrently(clips, MEDIA_DOWNLOAD_CONCURRENCY, deadline, (clip) =>
        storeClipMedia(ctx, gate, clip, timestamp),
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
async function storeFirstArchived(
  ctx: ActionCtx,
  gate: ArchiveGate,
  timestamp: string,
  urls: string[],
) {
  for (const url of urls) {
    const blob = await fetchArchivedFile(gate, timestamp, url)
    if (blob) return await ctx.storage.store(blob)
  }
  return undefined
}

async function storeClipMedia(
  ctx: ActionCtx,
  gate: ArchiveGate,
  clip: Doc<'clips'>,
  timestamp: string,
) {
  let previewStorageId: Id<'_storage'> | undefined
  let thumbnailStorageId: Id<'_storage'> | undefined
  let failed = false
  try {
    previewStorageId = await storeFirstArchived(ctx, gate, timestamp, [
      clipMediaUrl(clip, 'preview_144.mp4'),
    ])
    thumbnailStorageId = await storeFirstArchived(ctx, gate, timestamp, [
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

/**
 * Checks each clip once, right after the profile is retrieved, and again for the
 * missing ones when someone asks to search again.
 */
export const checkProfileVideos = internalAction({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const gate = archiveGate(ctx)
    const deadline = Date.now() + PHASE_TIME_BUDGET_MS
    for (;;) {
      const clips: Doc<'clips'>[] = await ctx.runQuery(
        internal.retrieval.listClipsNeedingVideoCheck,
        { profileId },
      )
      if (clips.length === 0) break

      await forEachConcurrently(clips, VIDEO_CHECK_CONCURRENCY, deadline, (clip) =>
        checkClipVideo(ctx, gate, clip),
      )

      if (Date.now() > deadline) {
        await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, { profileId })
        return null
      }
    }
    return null
  },
})

type FullVideo = { capture: Snapshot; quality: number }

/**
 * Probes the clip's full-length MP4s directly, best quality first: about a second
 * per probe, where a CDX listing takes 10-40s and has a much tighter rate limit.
 */
async function probeFullVideo(gate: ArchiveGate, clip: Doc<'clips'>): Promise<FullVideo | null> {
  for (const host of cdnHostVariants(clip.cdnHost)) {
    for (const quality of FULL_VIDEO_QUALITIES) {
      const url = clipVideoUrl(host, clip.mediaId, quality)
      const capture = await findCapture(gate, PLAYSTV_SHUTDOWN_TIMESTAMP, url)
      if (capture) return { capture, quality }
    }
  }
  return null
}

async function checkClipVideo(ctx: ActionCtx, gate: ArchiveGate, clip: Doc<'clips'>) {
  let video: FullVideo | null
  try {
    video = await probeFullVideo(gate, clip)
  } catch {
    await ctx.runMutation(internal.retrieval.saveClipVideo, {
      clipId: clip._id,
      videoStatus: 'failed',
    })
    return
  }
  await ctx.runMutation(internal.retrieval.saveClipVideo, {
    clipId: clip._id,
    videoStatus: video ? 'available' : 'unavailable',
    videoUrl: video ? rawCaptureUrl(video.capture.timestamp, video.capture.url) : undefined,
    videoQuality: video?.quality,
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
    const clip = await ctx.db.get('clips', clipId)
    if (!clip) return null
    await ctx.db.patch('clips', clipId, video)

    if (video.videoStatus === 'available' && clip.videoStatus !== 'available') {
      const profile = await ctx.db.get('profiles', clip.profileId)
      if (profile?.recoveredCount !== undefined) {
        await ctx.db.patch('profiles', profile._id, { recoveredCount: profile.recoveredCount + 1 })
      }
      if (clip.gameId) await countRecoveredClip(ctx, clip.gameId)
    }
    return null
  },
})
