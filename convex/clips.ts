import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { createOwnerLoader, retryClipVideo, toClipView, toOwnedClipView } from './model/clips'
import { listFeedPage } from './model/feed'
import { blacklistedClipIds, isBlacklisted } from './model/moderation'
import { getProfileByUsername, isProfileHidden } from './model/profiles'

const MAX_CLIPS = 500

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get('profiles', profileId)
    const timestamp = profile?.snapshotTimestamp
    if (!timestamp || isProfileHidden(profile)) return []

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

/**
 * What a shared clip link's preview (Discord, etc.) shows. Takes the id as a plain
 * string, since it comes from a URL. Null for unknown, blacklisted or unwatchable clips.
 */
export const getShareInfo = query({
  args: { clipId: v.string() },
  handler: async (ctx, { clipId }) => {
    const id = ctx.db.normalizeId('clips', clipId)
    const clip = id && (await ctx.db.get('clips', id))
    if (!clip || clip.videoStatus !== 'available' || (await isBlacklisted(ctx, clip._id))) {
      return null
    }
    const view = await toOwnedClipView(ctx, clip, createOwnerLoader(ctx))
    if (!view) return null
    return {
      // Null when an admin hid it.
      title: view.title,
      gameName: view.gameName,
      username: view.owner.username,
      uploadedAt: view.uploadedAt,
      thumbnailUrl: view.thumbnailUrl,
    }
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

/**
 * Every recovered clip across all profiles, newest upload first by default. Narrowed by
 * words in the title (then ordered by relevance), uploader (`username`), game, and upload
 * date (`from`/`to`, inclusive, in ms).
 */
export const listFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    username: v.optional(v.string()),
    gameId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    sort: v.optional(feedSort),
  },
  handler: async (ctx, { paginationOpts, username, sort = 'uploaded_desc', ...filters }) => {
    let profileId: Id<'profiles'> | undefined
    if (username) {
      const profile = await getProfileByUsername(ctx, username)
      if (!profile || isProfileHidden(profile)) return { page: [], isDone: true, continueCursor: '' }
      profileId = profile._id
    }
    const search = filters.search?.trim() || undefined
    return await listFeedPage(ctx, { ...filters, search, profileId, sort }, paginationOpts)
  },
})
