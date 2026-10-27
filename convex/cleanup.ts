import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { deleteProfile, getProfileByUsername, RETENTION_MS } from './model/profiles'

const BATCH_SIZE = 20

/** Deletes profiles (with their clips and files) older than the retention period. */
export const deleteExpiredProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS
    const expired = await ctx.db
      .query('profiles')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(BATCH_SIZE)

    for (const profile of expired) await deleteProfile(ctx, profile)

    if (expired.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredProfiles, {})
    }
    return null
  },
})

/** Maintenance: forget a username so the next lookup retrieves it from scratch. */
export const deleteProfileByUsername = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const profile = await getProfileByUsername(ctx, username)
    if (profile) await deleteProfile(ctx, profile)
    return profile !== null
  },
})
