import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const profileStatus = v.union(
  v.literal('searching'),
  v.literal('ready'),
  v.literal('not_found'),
  v.literal('error'),
)

export const mediaStatus = v.union(
  v.literal('pending'),
  v.literal('stored'),
  v.literal('missing'),
  v.literal('failed'),
)

/** Whether the full-length clip (not just its preview) exists in the Wayback Machine. */
export const videoStatus = v.union(
  v.literal('checking'),
  v.literal('available'),
  v.literal('unavailable'),
  v.literal('failed'),
)

export const clipFields = {
  videoId: v.string(),
  mediaId: v.string(),
  cdnHost: v.string(),
  title: v.string(),
  durationSeconds: v.optional(v.number()),
  uploadedAt: v.optional(v.number()),
}

export default defineSchema({
  // One row per looked-up username. Deleted (with its clips and files) after 7 days.
  profiles: defineTable({
    usernameKey: v.string(),
    username: v.string(),
    status: profileStatus,
    error: v.optional(v.string()),
    snapshotTimestamp: v.optional(v.string()),
    snapshotUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
  }).index('by_usernameKey', ['usernameKey']),

  clips: defineTable({
    profileId: v.id('profiles'),
    ...clipFields,
    mediaStatus: mediaStatus,
    previewStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
    videoStatus: videoStatus,
    videoUrl: v.optional(v.string()),
    videoQuality: v.optional(v.number()),
  }).index('by_profileId_and_uploadedAt', ['profileId', 'uploadedAt']),
})
