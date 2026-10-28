import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import {
  deleteProfile,
  deleteStoredClipMedia,
  getProfileByUsername,
  RETENTION_MS,
} from './model/profiles'

const CLIP_BATCH_SIZE = 100

/**
 * Deletes the stored clip previews and thumbnails of profiles older than the
 * retention period, one batch at a time. The profiles and clips themselves stay.
 */
export const deleteExpiredMedia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_mediaExpired', (q) =>
        q.eq('mediaExpired', undefined).lt('_creationTime', cutoff),
      )
      .first()
    if (!profile) return null

    await deleteStoredClipMedia(ctx, profile, CLIP_BATCH_SIZE)
    await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredMedia, {})
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
