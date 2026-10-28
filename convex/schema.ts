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
  // Legacy: the stored copies were deleted by a 30-day cleanup that no longer runs.
  // Previews play from the Wayback Machine until a revisit stores them again.
  v.literal('expired'),
)

/** Whether the full-length clip (not just its preview) exists in the Wayback Machine. */
export const videoStatus = v.union(
  v.literal('checking'),
  v.literal('available'),
  v.literal('unavailable'),
  // Nothing was found on the first pass; looked up once more before becoming 'unavailable'.
  v.literal('rechecking'),
  v.literal('failed'),
)

export const clipFields = {
  videoId: v.string(),
  mediaId: v.string(),
  cdnHost: v.string(),
  title: v.string(),
  durationSeconds: v.optional(v.number()),
  uploadedAt: v.optional(v.number()),
  // Only on clips retrieved since games were stored.
  gameId: v.optional(v.string()),
  gameName: v.optional(v.string()),
}

export default defineSchema({
  // One row per looked-up username. Profiles, clips and their stored files are kept for good.
  profiles: defineTable({
    usernameKey: v.string(),
    username: v.string(),
    status: profileStatus,
    error: v.optional(v.string()),
    snapshotTimestamp: v.optional(v.string()),
    snapshotUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')),
    // True when the Archive failed partway through the "load more" pages.
    clipListIncomplete: v.optional(v.boolean()),
    // Missing on profiles retrieved before it was stored, until the backfill runs.
    clipCount: v.optional(v.number()),
    // How many clips have a full-length video. Missing on profiles retrieved before
    // it was tracked, until `migrations:backfillRecoveredCount` runs.
    recoveredCount: v.optional(v.number()),
    // Legacy: set by a 30-day cleanup that no longer runs. Unused.
    mediaExpired: v.optional(v.boolean()),
  })
    .index('by_usernameKey', ['usernameKey'])
    .index('by_status', ['status']),

  // Singleton: when the Archive rate-limits or refuses one request, every action
  // holds off until `pausedUntil` (see model/archive.ts).
  archiveStatus: defineTable({
    pausedUntil: v.number(),
  }),

  clips: defineTable({
    profileId: v.id('profiles'),
    ...clipFields,
    mediaStatus: mediaStatus,
    previewStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
    videoStatus: videoStatus,
    videoUrl: v.optional(v.string()),
    videoQuality: v.optional(v.number()),
  })
    .index('by_profileId_and_uploadedAt', ['profileId', 'uploadedAt'])
    .index('by_profileId_and_mediaStatus', ['profileId', 'mediaStatus'])
    .index('by_profileId_and_videoStatus', ['profileId', 'videoStatus'])
    // The feed: every recovered clip (optionally of one game) by its Plays.tv upload
    // date, or by when it was added here (`_creationTime`, which every index ends with).
    .index('by_videoStatus_and_uploadedAt', ['videoStatus', 'uploadedAt'])
    .index('by_videoStatus_and_gameId_and_uploadedAt', ['videoStatus', 'gameId', 'uploadedAt'])
    .index('by_videoStatus', ['videoStatus'])
    .index('by_videoStatus_and_gameId', ['videoStatus', 'gameId']),

  // One row per game seen in a clip list, for the feed's game filter.
  games: defineTable({
    gameId: v.string(),
    name: v.string(),
    // How many of its clips have a full-length video.
    recoveredCount: v.number(),
  })
    .index('by_gameId', ['gameId'])
    .index('by_recoveredCount', ['recoveredCount']),
})
