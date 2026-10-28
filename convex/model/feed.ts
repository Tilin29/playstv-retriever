// The feed: every recovered clip across all profiles, filtered by title, uploader, game
// and upload date. Each combination reads through the index that narrows it most; the
// filters an index can't cover are applied as the page is read.
import type { PaginationOptions } from 'convex/server'
import type { Id } from '../_generated/dataModel'
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
