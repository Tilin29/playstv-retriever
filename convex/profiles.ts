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
      expiresAt: profile._creationTime + Profiles.RETENTION_MS,
      clipListIncomplete: profile.clipListIncomplete ?? false,
    }
  },
})

const RECENT_PROFILES_LIMIT = 8

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await Profiles.listRecentProfiles(ctx, RECENT_PROFILES_LIMIT)
    return await Promise.all(
      profiles.map(async (profile) => ({
        _id: profile._id,
        // `username` is the display name; the key is what the profile is looked up by.
        username: profile.username,
        usernameKey: profile.usernameKey,
        clipCount: profile.clipCount ?? null,
        retrievedAt: profile._creationTime,
        avatarUrl: profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
      })),
    )
  },
})

/**
 * Starts retrieving a username from the Wayback Machine, unless a usable result
 * already exists. Failed or expired results are discarded and retried.
 */
export const lookup = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    if (!Profiles.isValidUsername(username)) throw new ConvexError('Invalid username')

    const existing = await Profiles.getProfileByUsername(ctx, username)
    if (existing && existing.status !== 'error' && !Profiles.isExpired(existing, Date.now())) {
      if (existing.status === 'ready') await Profiles.retryFailedMedia(ctx, existing)
      return existing._id
    }
    if (existing) await Profiles.deleteProfile(ctx, existing)

    const profileId = await ctx.db.insert('profiles', {
      usernameKey: Profiles.toUsernameKey(username),
      username,
      status: 'searching',
    })
    await ctx.scheduler.runAfter(0, internal.retrieval.retrieveProfile, { profileId, username })
    return profileId
  },
})
