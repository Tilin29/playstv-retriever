// The feed: every recovered clip across all profiles, filtered by title, uploader, game
// and upload date. Each combination reads through the index that narrows it most; the
// filters an index can't cover are applied as the page is read.
import type { PaginationOptions } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { createOwnerLoader, toOwnedClipView } from './clips'
import { isBlacklisted } from './moderation'

export type FeedSort = 'uploaded_desc' | 'uploaded_asc' | 'added_desc' | 'added_asc'

export type FeedFilters = {
  /** Words in the title. Results are then ordered by relevance, not `sort`. */
  search?: string
  profileId?: Id<'profiles'>
  gameId?: string
  /** Uploaded on or after this time (ms). */
  from?: number
  /** Uploaded on or before this time (ms). */
  to?: number
  sort: FeedSort
}

// Upload dates are real timestamps, so these bounds keep every dated clip while leaving
// out the ones without a date (which sort below any number).
const EARLIEST = 0
const LATEST = Number.MAX_SAFE_INTEGER

export async function listFeedPage(
  ctx: QueryCtx,
  filters: FeedFilters,
  paginationOpts: PaginationOptions,
) {
  const result = await queryFeed(ctx, filters).paginate(paginationOpts)
  const loadOwner = createOwnerLoader(ctx)
  const page = await Promise.all(
    result.page.map(async (clip) =>
      // Blacklisted clips are rare, so they're dropped from the page rather than indexed out.
      (await isBlacklisted(ctx, clip._id)) ? null : await toOwnedClipView(ctx, clip, loadOwner),
    ),
  )
  return { ...result, page: page.filter((clip) => clip !== null) }
}

// When at most this many clips match, the pick is made among all of them.
const SMALL_POOL = 500
// How far a pick reads along the shuffle order for a clip that matches.
const MAX_SHUFFLE_SCAN = 2000

/**
 * A random clip matching the feed's filters, other than the `exclude`d ones (those
 * already played). `seed` (0 to 1) picks it, so the same arguments give the same clip.
 * When few clips match (always for a title search or one uploader), it's one of all of
 * them; otherwise the first match from a random point in the clips' shuffle order.
 * Null once every match was played.
 */
export async function pickRandomFeedClip(
  ctx: QueryCtx,
  filters: Omit<FeedFilters, 'sort'>,
  { seed, exclude }: { seed: number; exclude: Id<'clips'>[] },
) {
  const excluded = new Set(exclude)
  const loadOwner = createOwnerLoader(ctx)
  const toView = async (clip: Doc<'clips'>) =>
    excluded.has(clip._id) || (await isBlacklisted(ctx, clip._id))
      ? null
      : await toOwnedClipView(ctx, clip, loadOwner)

  const pool = await queryFeed(ctx, { ...filters, sort: 'uploaded_desc' }).take(SMALL_POOL + 1)
  const pickFromPool = async () => {
    const candidates = pool.slice(0, SMALL_POOL).filter((clip) => !excluded.has(clip._id))
    const start = Math.floor(seed * candidates.length)
    // Blacklisted clips and hidden profiles are rare; the next candidate stands in.
    for (let offset = 0; offset < candidates.length; offset++) {
      const view = await toView(candidates[(start + offset) % candidates.length]!)
      if (view) return view
    }
    return null
  }
  if (pool.length <= SMALL_POOL || filters.search || filters.profileId) return await pickFromPool()

  const { gameId, from, to } = filters
  const dated = from !== undefined || to !== undefined
  const lower = from ?? EARLIEST
  const upper = to ?? LATEST
  let scanned = 0
  // From the seed to the end of the order, then from its start up to the seed.
  for (const [start, end] of [
    [seed, 1],
    [0, seed],
  ] as const) {
    for await (const clip of shuffleOrder(ctx, gameId, start, end)) {
      if (++scanned > MAX_SHUFFLE_SCAN) break
      const { uploadedAt } = clip
      if (dated && (uploadedAt === undefined || uploadedAt < lower || uploadedAt > upper)) continue
      const view = await toView(clip)
      if (view) return view
    }
  }
  // Nothing found along the shuffle order (matches are scarce there, or clips are
  // missing their keys before the backfill): one of the newest matches instead.
  return await pickFromPool()
}

/** Recovered clips (of one game) with a shuffle key in [start, end). */
function shuffleOrder(ctx: QueryCtx, gameId: string | undefined, start: number, end: number) {
  const clips = ctx.db.query('clips')
  return gameId
    ? clips.withIndex('by_videoStatus_and_gameId_and_shuffleKey', (q) =>
        q
          .eq('videoStatus', 'available')
          .eq('gameId', gameId)
          .gte('shuffleKey', start)
          .lt('shuffleKey', end),
      )
    : clips.withIndex('by_videoStatus_and_shuffleKey', (q) =>
        q.eq('videoStatus', 'available').gte('shuffleKey', start).lt('shuffleKey', end),
      )
}

function queryFeed(ctx: QueryCtx, { search, profileId, gameId, from, to, sort }: FeedFilters) {
  const byUpload = sort.startsWith('uploaded')
  const order = sort.endsWith('asc') ? 'asc' : 'desc'
  const dated = from !== undefined || to !== undefined
  const lower = from ?? EARLIEST
  const upper = to ?? LATEST
  const clips = ctx.db.query('clips')

  if (search) {
    return (
      clips
        .withSearchIndex('search_title', (q) => {
          const query = q.search('title', search).eq('videoStatus', 'available')
          if (gameId && profileId) return query.eq('gameId', gameId).eq('profileId', profileId)
          if (gameId) return query.eq('gameId', gameId)
          if (profileId) return query.eq('profileId', profileId)
          return query
        })
        // A hidden title must not be findable by the words in it.
        .filter((q) =>
          q.and(
            q.neq(q.field('titleHidden'), true),
            dated
              ? q.and(q.gte(q.field('uploadedAt'), lower), q.lte(q.field('uploadedAt'), upper))
              : true,
          ),
        )
    )
  }

  if (profileId) {
    // One profile's clips are few, so its game and date filters can run on the page.
    const ofProfile = byUpload
      ? clips.withIndex('by_profileId_and_uploadedAt', (q) =>
          dated
            ? q.eq('profileId', profileId).gte('uploadedAt', lower).lte('uploadedAt', upper)
            : q.eq('profileId', profileId),
        )
      : clips.withIndex('by_profileId_and_videoStatus', (q) =>
          q.eq('profileId', profileId).eq('videoStatus', 'available'),
        )
    return ofProfile
      .order(order)
      .filter((q) =>
        q.and(
          q.eq(q.field('videoStatus'), 'available'),
          gameId ? q.eq(q.field('gameId'), gameId) : true,
          dated && !byUpload
            ? q.and(q.gte(q.field('uploadedAt'), lower), q.lte(q.field('uploadedAt'), upper))
            : true,
        ),
      )
  }

  if (byUpload) {
    const byDate = gameId
      ? clips.withIndex('by_videoStatus_and_gameId_and_uploadedAt', (q) =>
          dated
            ? q
                .eq('videoStatus', 'available')
                .eq('gameId', gameId)
                .gte('uploadedAt', lower)
                .lte('uploadedAt', upper)
            : q.eq('videoStatus', 'available').eq('gameId', gameId),
        )
      : clips.withIndex('by_videoStatus_and_uploadedAt', (q) =>
          dated
            ? q.eq('videoStatus', 'available').gte('uploadedAt', lower).lte('uploadedAt', upper)
            : q.eq('videoStatus', 'available'),
        )
    return byDate.order(order)
  }

  // By when it was recovered here (`_creationTime`, which every index ends with).
  const byRecovery = gameId
    ? clips.withIndex('by_videoStatus_and_gameId', (q) =>
        q.eq('videoStatus', 'available').eq('gameId', gameId),
      )
    : clips.withIndex('by_videoStatus', (q) => q.eq('videoStatus', 'available'))
  return byRecovery
    .order(order)
    .filter((q) =>
      dated
        ? q.and(q.gte(q.field('uploadedAt'), lower), q.lte(q.field('uploadedAt'), upper))
        : true,
    )
}
