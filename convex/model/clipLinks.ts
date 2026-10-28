// Looking up clips by their plays.tv/video/<id> link. A clip's page id isn't the id
// its video files use, so the clip's archived embed (or video) page is read for the
// media id, title and uploader. The clip is then filed under its uploader's profile,
// which is retrieved first when it hasn't been yet, so the usual media download and
// full-video check pick it up.
import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components, internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createOwnerLoader, toOwnedClipView } from './clips'
import { addGames } from './games'
import { isBlacklisted } from './moderation'
import {
  CLIP_LINK_PATTERN,
  CLIP_VIDEO_ID_PATTERN,
  clipPageUrls,
  parseClipPage,
  PLAYSTV_SHUTDOWN_TIMESTAMP,
  SHORT_LINK_CODE_PATTERN,
  shortLinkUrl,
  type ParsedClip,
} from './playstv'
import { getProfileByUsername, isValidUsername, startProfileLookup } from './profiles'
import {
  fetchCaptureHtml,
  fetchClosestCaptureHtml,
  findRedirectTarget,
  listCaptures,
  type ArchiveGate,
  type Snapshot,
} from './wayback'

export const MAX_CLIP_LINKS = 50
// Captures tried per URL prefix when the direct embed lookup finds nothing.
const MAX_FALLBACK_CAPTURES = 3

export type ClipPage = { clip: ParsedClip; ownerUsername: string; snapshot: Snapshot }

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Each new link costs a few Archive requests; this keeps one visitor from queueing
  // thousands of them.
  clipLinkLookup: { kind: 'token bucket', rate: 300, period: HOUR, capacity: 100 },
})

async function getClipByVideoId(ctx: QueryCtx, videoId: string) {
  return await ctx.db
    .query('clips')
    .withIndex('by_videoId', (q) => q.eq('videoId', videoId))
    .first()
}

async function getClipLink(ctx: QueryCtx, videoId: string) {
  return await ctx.db
    .query('clipLinks')
    .withIndex('by_videoId', (q) => q.eq('videoId', videoId))
    .unique()
}

/**
 * A pasted link as the client sends it: a clip's page id (plays.tv/video/<id>), or
 * `s:<code>` for a share link (plays.tv/s/<code>), which redirected to the clip's page.
 */
type LinkKey = { kind: 'video'; videoId: string } | { kind: 'short'; code: string }

function parseLinkKey(key: string): LinkKey | null {
  if (key.startsWith('s:')) {
    const code = key.slice(2)
    return SHORT_LINK_CODE_PATTERN.test(code) ? { kind: 'short', code } : null
  }
  return CLIP_VIDEO_ID_PATTERN.test(key) ? { kind: 'video', videoId: key } : null
}

function parseLinkKeys(keys: string[]) {
  const unique = [...new Set(keys)]
  if (unique.length > MAX_CLIP_LINKS) {
    throw new ConvexError(`Look up at most ${MAX_CLIP_LINKS} links at once`)
  }
  return unique.map((key) => {
    const parsed = parseLinkKey(key)
    if (!parsed) throw new ConvexError('Invalid clip link')
    return parsed
  })
}

async function getShortLink(ctx: QueryCtx, code: string) {
  return await ctx.db
    .query('shortLinks')
    .withIndex('by_code', (q) => q.eq('code', code))
    .unique()
}

/**
 * Starts looking up each linked clip that isn't stored or being looked up yet. Share
 * links are first resolved to the clip they pointed to. Links that failed because the
 * Archive errored are tried again.
 */
export async function startClipLinkLookups(ctx: MutationCtx, keys: string[]) {
  const videoIds: string[] = []
  const shortToStart: { code: string; shortLink: Doc<'shortLinks'> | null }[] = []
  for (const key of parseLinkKeys(keys)) {
    if (key.kind === 'video') {
      videoIds.push(key.videoId)
      continue
    }
    const shortLink = await getShortLink(ctx, key.code)
    if (shortLink?.videoId) videoIds.push(shortLink.videoId)
    else if (!shortLink || shortLink.status === 'error') shortToStart.push({ code: key.code, shortLink })
  }
  const videosToStart = await videoLookupsToStart(ctx, videoIds)
  const count = videosToStart.length + shortToStart.length
  if (count === 0) return

  const { ok } = await rateLimiter.limit(ctx, 'clipLinkLookup', { count })
  if (!ok) throw new ConvexError('Too many links looked up right now. Try again in a few minutes.')

  for (const { code, shortLink } of shortToStart) {
    if (shortLink) await ctx.db.patch('shortLinks', shortLink._id, { status: 'searching' })
    else await ctx.db.insert('shortLinks', { code, status: 'searching' })
    await ctx.scheduler.runAfter(0, internal.clipLinks.resolveShortLink, { code })
  }
  await startVideoLookups(ctx, videosToStart)
}

/** The clips not stored or being looked up yet, with their failed lookup if there was one. */
async function videoLookupsToStart(ctx: QueryCtx, videoIds: string[]) {
  const toStart: { videoId: string; link: Doc<'clipLinks'> | null }[] = []
  for (const videoId of new Set(videoIds)) {
    if (await getClipByVideoId(ctx, videoId)) continue
    const link = await getClipLink(ctx, videoId)
    if (!link || link.status === 'error') toStart.push({ videoId, link })
  }
  return toStart
}

async function startVideoLookups(
  ctx: MutationCtx,
  toStart: { videoId: string; link: Doc<'clipLinks'> | null }[],
) {
  for (const { videoId, link } of toStart) {
    if (link) await ctx.db.patch('clipLinks', link._id, { status: 'searching' })
    else await ctx.db.insert('clipLinks', { videoId, status: 'searching' })
    await ctx.scheduler.runAfter(0, internal.clipLinks.resolve, { videoId })
  }
}

/**
 * Finds the clip a share link pointed to. Captures from after the shutdown only
 * redirect to Medal, so only earlier ones are read. Null when none were archived.
 */
export async function findShortLinkTarget(gate: ArchiveGate, code: string) {
  const captures = (
    await listCaptures(gate, shortLinkUrl(code), undefined, {
      statusCode: 301,
      to: PLAYSTV_SHUTDOWN_TIMESTAMP,
    })
  ).filter((capture) => new URL(capture.url).pathname === `/s/${code}`)
  for (const capture of captures.slice(0, MAX_FALLBACK_CAPTURES)) {
    const target = await findRedirectTarget(gate, capture)
    const videoId = target && CLIP_LINK_PATTERN.exec(target)?.[1]
    if (videoId) return videoId
  }
  return null
}

/** Records where a share link led and, if it was a clip, looks that clip up. */
export async function saveShortLink(
  ctx: MutationCtx,
  code: string,
  result: { videoId: string } | 'not_found' | 'error',
) {
  const shortLink = await getShortLink(ctx, code)
  if (!shortLink) return
  if (typeof result === 'string') {
    await ctx.db.patch('shortLinks', shortLink._id, { status: result })
    return
  }
  await ctx.db.patch('shortLinks', shortLink._id, { status: 'found', videoId: result.videoId })
  // Already paid for by the share link's own lookup.
  await startVideoLookups(ctx, await videoLookupsToStart(ctx, [result.videoId]))
}
/**
 * Finds and parses the clip's archived page: the embed page closest to the shutdown
 * first (one fast request), then whatever embed or video page captures a search lists.
 * Null when none of them shows the clip.
 */
export async function findClipPage(gate: ArchiveGate, videoId: string): Promise<ClipPage | null> {
  const [embedUrl] = clipPageUrls(videoId)
  const direct = await fetchClosestCaptureHtml(gate, PLAYSTV_SHUTDOWN_TIMESTAMP, embedUrl)
  const parsedDirect = direct && parseClipPage(direct.html, videoId)
  if (parsedDirect) return { ...parsedDirect, snapshot: direct.snapshot }

  // Captures saved with a query string or a title slug in the URL only show up in a search.
  for (const prefix of clipPageUrls(videoId)) {
    const captures = await listCaptures(gate, prefix.replace(/^https:\/\//, ''))
    for (const snapshot of captures.slice(0, MAX_FALLBACK_CAPTURES)) {
      const html = await fetchCaptureHtml(gate, snapshot)
      const parsed = html && parseClipPage(html, videoId)
      if (parsed) return { ...parsed, snapshot }
    }
  }
  return null
}

export async function markClipLink(
  ctx: MutationCtx,
  videoId: string,
  status: 'not_found' | 'error',
) {
  const link = await getClipLink(ctx, videoId)
  if (link) await ctx.db.patch('clipLinks', link._id, { status, waiting: undefined })
}

/** Files the clip read from its page under its uploader's profile. */
export async function saveClipPage(ctx: MutationCtx, videoId: string, page: ClipPage) {
  const link = await getClipLink(ctx, videoId)
  if (!link) return
  if (!(await getClipByVideoId(ctx, videoId))) {
    if (!isValidUsername(page.ownerUsername)) {
      await markClipLink(ctx, videoId, 'not_found')
      return
    }

    let profile = await getProfileByUsername(ctx, page.ownerUsername)
    if (profile?.status === 'not_found') profile = await adoptClipPageAsProfile(ctx, profile, page)
    if (profile?.status !== 'ready') {
      // Added once the profile's own clip list is stored (see `settleWaitingClipLinks`).
      const profileId =
        profile?.status === 'searching'
          ? profile._id
          : await startProfileLookup(ctx, page.ownerUsername, profile)
      await ctx.db.patch('clipLinks', link._id, {
        waiting: {
          profileId,
          clip: page.clip,
          snapshotTimestamp: page.snapshot.timestamp,
          snapshotUrl: page.snapshot.url,
        },
      })
      return
    }
    await addLinkedClip(ctx, profile, page.clip, { scheduleWork: true })
  }
  await ctx.db.patch('clipLinks', link._id, { status: 'found', waiting: undefined })
}

/**
 * A profile whose own page was never archived still gets the clips found through
 * their links; the clip's page stands in as its snapshot.
 */
async function adoptClipPageAsProfile(
  ctx: MutationCtx,
  profile: Doc<'profiles'>,
  page: Pick<ClipPage, 'snapshot'>,
) {
  await ctx.db.patch('profiles', profile._id, {
    status: 'ready',
    snapshotTimestamp: page.snapshot.timestamp,
    snapshotUrl: page.snapshot.url,
    clipCount: 0,
    recoveredCount: 0,
  })
  return await ctx.db.get('profiles', profile._id)
}

/**
 * Adds a clip found through its link to a ready profile, unless it's already there.
 * `scheduleWork` starts its media download and full-video check; leave it off when the
 * profile-wide phases are about to run anyway.
 */
async function addLinkedClip(
  ctx: MutationCtx,
  profile: Doc<'profiles'>,
  clip: ParsedClip,
  { scheduleWork }: { scheduleWork: boolean },
) {
  if (await getClipByVideoId(ctx, clip.videoId)) return
  const clipId = await ctx.db.insert('clips', {
    ...clip,
    profileId: profile._id,
    mediaStatus: 'pending',
    videoStatus: 'checking',
  })
  if (profile.clipCount !== undefined) {
    await ctx.db.patch('profiles', profile._id, { clipCount: profile.clipCount + 1 })
  }
  await addGames(ctx, [clip])
  if (scheduleWork && profile.snapshotTimestamp) {
    await ctx.scheduler.runAfter(0, internal.retrieval.downloadClipMedia, {
      clipId,
      timestamp: profile.snapshotTimestamp,
    })
    await ctx.scheduler.runAfter(0, internal.retrieval.checkOneClipVideo, { clipId })
  }
}

/**
 * Called when a profile that links were waiting on finishes retrieving. Returns
 * whether the profile is ready afterwards: one that wasn't archived becomes ready
 * when a waiting link found a clip of it.
 */
export async function settleWaitingClipLinks(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  outcome: 'ready' | 'not_found' | 'error',
) {
  const links = await ctx.db
    .query('clipLinks')
    .withIndex('by_waiting_profileId', (q) => q.eq('waiting.profileId', profileId))
    .take(MAX_CLIP_LINKS * 4)
  if (links.length === 0) return outcome === 'ready'

  if (outcome === 'error') {
    for (const link of links) await markClipLink(ctx, link.videoId, 'error')
    return false
  }

  let profile = await ctx.db.get('profiles', profileId)
  if (!profile) return false
  if (outcome === 'not_found') {
    const [{ waiting }] = links
    profile = await adoptClipPageAsProfile(ctx, profile, {
      snapshot: { timestamp: waiting!.snapshotTimestamp, url: waiting!.snapshotUrl },
    })
    if (!profile) return false
  }
  for (const link of links) {
    await addLinkedClip(ctx, profile, link.waiting!.clip, { scheduleWork: outcome === 'not_found' })
    // The patch above may have changed the clip count.
    profile = (await ctx.db.get('profiles', profileId)) ?? profile
    await ctx.db.patch('clipLinks', link._id, { status: 'found', waiting: undefined })
  }
  return true
}

/**
 * Where each link's lookup stands, with its clip once found. `key` is the link as given;
 * keys that aren't valid links are left out.
 */
export async function listClipLinkResults(ctx: QueryCtx, keys: string[]) {
  const loadOwner = createOwnerLoader(ctx)
  const results = await Promise.all(
    keys.slice(0, MAX_CLIP_LINKS).map(async (key) => {
      const parsed = parseLinkKey(key)
      if (!parsed) return null
      let videoId: string
      if (parsed.kind === 'short') {
        const shortLink = await getShortLink(ctx, parsed.code)
        if (!shortLink?.videoId) {
          return { key, status: shortLink?.status ?? ('searching' as const), clip: null }
        }
        videoId = shortLink.videoId
      } else {
        videoId = parsed.videoId
      }
      return { key, ...(await videoLinkResult(ctx, videoId, loadOwner)) }
    }),
  )
  return results.filter((result) => result !== null)
}

async function videoLinkResult(
  ctx: QueryCtx,
  videoId: string,
  loadOwner: ReturnType<typeof createOwnerLoader>,
) {
  const clip = await getClipByVideoId(ctx, videoId)
  if (clip) {
    const view = (await isBlacklisted(ctx, clip._id))
      ? null
      : await toOwnedClipView(ctx, clip, loadOwner)
    return { status: view ? ('found' as const) : ('not_found' as const), clip: view }
  }
  const status = (await getClipLink(ctx, videoId))?.status ?? 'searching'
  // A found link whose clip is gone (e.g. its profile was deleted) shows as not found.
  return { status: status === 'found' ? ('not_found' as const) : status, clip: null }
}
