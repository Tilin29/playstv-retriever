import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { createOwnerLoader, retryClipVideo, toClipView, toOwnedClipView } from './model/clips'
import { blacklistedClipIds, isBlacklisted } from './model/moderation'

const MAX_CLIPS = 500

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get('profiles', profileId)
    const timestamp = profile?.snapshotTimestamp
    if (!timestamp) return []

    const clips = await ctx.db
      .query('clips')
      .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
      .order('desc')
      .take(MAX_CLIPS)
    const blacklisted = await blacklistedClipIds(ctx, profileId, MAX_CLIPS)
    return await Promise.all(
      clips
        .filter((clip) => !blacklisted.has(clip._id))
        .map((clip) => toClipView(ctx, clip, timestamp)),
    )
  },
})

/** Looks for a clip's full video again when the Archive didn't respond the first time. */
export const retryVideo = mutation({
  args: { clipId: v.id('clips') },
  handler: async (ctx, { clipId }) => {
    await retryClipVideo(ctx, clipId)
    return null
  },
})

/** `uploaded`: when it was published on Plays.tv. `added`: when it was saved here. */
const feedSort = v.union(
  v.literal('uploaded_desc'),
  v.literal('uploaded_asc'),
  v.literal('added_desc'),
  v.literal('added_asc'),
)

/** Every recovered clip across all profiles (or of one game), newest upload first by default. */
export const listFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    gameId: v.optional(v.string()),
    sort: v.optional(feedSort),
  },
  handler: async (ctx, { paginationOpts, gameId, sort = 'uploaded_desc' }) => {
    const byUpload = sort.startsWith('uploaded')
    const recovered = ctx.db.query('clips')
    const clips = gameId
      ? recovered.withIndex(
          byUpload ? 'by_videoStatus_and_gameId_and_uploadedAt' : 'by_videoStatus_and_gameId',
          (q) => q.eq('videoStatus', 'available').eq('gameId', gameId),
        )
      : recovered.withIndex(byUpload ? 'by_videoStatus_and_uploadedAt' : 'by_videoStatus', (q) =>
          q.eq('videoStatus', 'available'),
        )
    const result = await clips.order(sort.endsWith('asc') ? 'asc' : 'desc').paginate(paginationOpts)

    const loadOwner = createOwnerLoader(ctx)
    const page = await Promise.all(
      result.page.map(async (clip) =>
        // Blacklisted clips are rare, so they're dropped from the page rather than indexed out.
        (await isBlacklisted(ctx, clip._id)) ? null : await toOwnedClipView(ctx, clip, loadOwner),
      ),
    )
    return { ...result, page: page.filter((clip) => clip !== null) }
  },
})
