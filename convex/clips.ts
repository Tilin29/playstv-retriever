import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { query } from './_generated/server'
import { toClipView } from './model/clips'

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
    return await Promise.all(clips.map((clip) => toClipView(ctx, clip, timestamp)))
  },
})

/** Every recovered clip across all profiles (or of one game), newest upload first. */
export const listFeed = query({
  args: { paginationOpts: paginationOptsValidator, gameId: v.optional(v.string()) },
  handler: async (ctx, { paginationOpts, gameId }) => {
    const clips = gameId
      ? ctx.db
          .query('clips')
          .withIndex('by_videoStatus_and_gameId_and_uploadedAt', (q) =>
            q.eq('videoStatus', 'available').eq('gameId', gameId),
          )
      : ctx.db
          .query('clips')
          .withIndex('by_videoStatus_and_uploadedAt', (q) => q.eq('videoStatus', 'available'))
    const result = await clips.order('desc').paginate(paginationOpts)

    const loadOwner = async (profileId: Id<'profiles'>) => {
      const profile = await ctx.db.get('profiles', profileId)
      if (!profile?.snapshotTimestamp) return null
      return {
        timestamp: profile.snapshotTimestamp,
        username: profile.username,
        usernameKey: profile.usernameKey,
        avatarUrl: profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
      }
    }
    // A page often holds several clips of the same profile, so each is loaded once.
    const owners = new Map<Id<'profiles'>, ReturnType<typeof loadOwner>>()

    const page = await Promise.all(
      result.page.map(async (clip) => {
        if (!owners.has(clip.profileId)) owners.set(clip.profileId, loadOwner(clip.profileId))
        const owner = await owners.get(clip.profileId)
        if (!owner) return null
        const { timestamp, ...ownerView } = owner
        return { ...(await toClipView(ctx, clip, timestamp)), owner: ownerView }
      }),
    )
    return { ...result, page: page.filter((clip) => clip !== null) }
  },
})
