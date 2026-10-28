import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import * as Profiles from './model/profiles'
import { captureUrl } from './model/wayback'

export const get = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const profile = await Profiles.getProfileByUsername(ctx, username)
    if (!profile) return null

    const { snapshotTimestamp, snapshotUrl, avatarStorageId } = profile
    return {
      _id: profile._id,
      username: profile.username,
      status: profile.status,
      error: profile.error ?? null,
      snapshotTimestamp: snapshotTimestamp ?? null,
      snapshotViewUrl:
        snapshotTimestamp && snapshotUrl ? captureUrl(snapshotTimestamp, snapshotUrl) : null,
      avatarUrl: avatarStorageId ? await ctx.storage.getUrl(avatarStorageId) : null,
      clipListIncomplete: profile.clipListIncomplete ?? false,
    }
  },
})

export const listRecent = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await Profiles.listRecentProfiles(ctx, paginationOpts)
    const page = await Promise.all(
      result.page.map(async (profile) => ({
        _id: profile._id,
        // `username` is the display name; the key is what the profile is looked up by.
        username: profile.username,
        usernameKey: profile.usernameKey,
        clipCount: profile.clipCount ?? null,
        recoveredCount: profile.recoveredCount ?? null,
        retrievedAt: profile._creationTime,
        avatarUrl: profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
      })),
    )
    return { ...result, page }
  },
})

/** Searches the Wayback Machine again for the clips whose full video wasn't found. */
export const retryMissingVideos = mutation({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get('profiles', profileId)
    if (!profile || profile.status !== 'ready') throw new ConvexError('Profile not found')
    await Profiles.retryMissingVideos(ctx, profile)
    return null
  },
})

/**
 * Starts retrieving a username from the Wayback Machine, unless it was already
 * looked up. Profiles are kept for good; a failed lookup is retried in place.
 */
export const lookup = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    if (!Profiles.isValidUsername(username)) throw new ConvexError('Invalid username')

    const existing = await Profiles.getProfileByUsername(ctx, username)
    if (existing && existing.status !== 'error') {
      if (existing.status === 'ready') await Profiles.retryFailedMedia(ctx, existing)
      return existing._id
    }

    // A failed lookup stored nothing, so it starts over on the same row.
    let profileId = existing?._id
    if (profileId) {
      await ctx.db.patch('profiles', profileId, { username, status: 'searching', error: undefined })
    } else {
      profileId = await ctx.db.insert('profiles', {
        usernameKey: Profiles.toUsernameKey(username),
        username,
        status: 'searching',
      })
    }
    await ctx.scheduler.runAfter(0, internal.retrieval.retrieveProfile, { profileId, username })
    return profileId
  },
})
