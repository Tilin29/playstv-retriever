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

/** The violations a clip can be reported for. */
export const reportReason = v.union(
  v.literal('sexual'),
  v.literal('violence'),
  v.literal('hate'),
  v.literal('harassment'),
  v.literal('personal_info'),
  v.literal('illegal'),
  v.literal('spam'),
  v.literal('copyright'),
  v.literal('other'),
)

export const reportStatus = v.union(
  v.literal('open'),
  // An admin looked at it and kept the clip up.
  v.literal('dismissed'),
  // The clip was blacklisted.
  v.literal('actioned'),
)

export const clipLinkStatus = v.union(
  v.literal('searching'),
  v.literal('found'),
  // The Archive has no copy of the clip's page.
  v.literal('not_found'),
  v.literal('error'),
)

/** Why a word in model/offensiveWords.ts is offensive. */
export const offensiveCategory = v.union(
  v.literal('racial'),
  v.literal('antisemitic'),
  v.literal('homophobic'),
  v.literal('transphobic'),
  v.literal('ableist'),
)

/** A word of the list found in a clip's title. */
export const titleMatch = v.object({
  // The list's entry, e.g. the slur itself.
  word: v.string(),
  category: offensiveCategory,
  // How it was written, after normalizing (see model/offensiveWords.ts).
  text: v.string(),
})

export const titleFlagStatus = v.union(
  v.literal('open'),
  // An admin looked at it; scans leave it alone from then on.
  v.literal('resolved'),
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

/** Clips uploaded to Plays.tv in one year, and how many of them have a full video. */
export const yearCount = v.object({
  year: v.number(),
  found: v.number(),
  recovered: v.number(),
})

/** What the archive stats count; also the running totals while they're recounted. */
export const siteStatsFields = {
  // Usernames looked up that were or weren't found in the Wayback Machine.
  usernamesSearched: v.number(),
  profilesFound: v.number(),
  clipsFound: v.number(),
  clipsRecovered: v.number(),
  // Oldest year first. Clips without an upload date are only in the totals.
  byYear: v.array(yearCount),
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
    // When an admin hid the whole profile. A hidden profile and its clips are left out
    // of every public query; its page says the user's content was blocked.
    hiddenAt: v.optional(v.number()),
  })
    .index('by_usernameKey', ['usernameKey'])
    .index('by_status', ['status'])
    .index('by_hiddenAt', ['hiddenAt']),

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
    // An admin hid the title for breaking the rules; only admins still see it.
    titleHidden: v.optional(v.boolean()),
    // Random in [0, 1), for shuffling the feed (see model/feed.ts). Missing on clips
    // stored before shuffling, until `migrations:backfillShuffleKeys` runs.
    shuffleKey: v.optional(v.number()),
  })
    .index('by_profileId_and_uploadedAt', ['profileId', 'uploadedAt'])
    .index('by_profileId_and_mediaStatus', ['profileId', 'mediaStatus'])
    .index('by_profileId_and_videoStatus', ['profileId', 'videoStatus'])
    // The feed: every recovered clip (optionally of one game) by its Plays.tv upload
    // date, or by when it was added here (`_creationTime`, which every index ends with).
    .index('by_videoStatus_and_uploadedAt', ['videoStatus', 'uploadedAt'])
    .index('by_videoStatus_and_gameId_and_uploadedAt', ['videoStatus', 'gameId', 'uploadedAt'])
    .index('by_videoStatus', ['videoStatus'])
    .index('by_videoStatus_and_gameId', ['videoStatus', 'gameId'])
    // Shuffling the feed: a random point in this order, then the clips after it.
    .index('by_videoStatus_and_shuffleKey', ['videoStatus', 'shuffleKey'])
    .index('by_videoStatus_and_gameId_and_shuffleKey', ['videoStatus', 'gameId', 'shuffleKey'])
    // Finds the clip a pasted plays.tv/video/<videoId> link points to.
    .index('by_videoId', ['videoId'])
    // The feed's title search, narrowed by the feed's other filters.
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['videoStatus', 'gameId', 'profileId'],
    }),

  // One row per game seen in a clip list, for the feed's game filter.
  games: defineTable({
    gameId: v.string(),
    name: v.string(),
    // How many of its clips have a full-length video.
    recoveredCount: v.number(),
  })
    .index('by_gameId', ['gameId'])
    .index('by_recoveredCount', ['recoveredCount'])
    // The feed's game picker, which there are too many games to list in full.
    .searchIndex('search_name', { searchField: 'name' }),

  // A pasted clip link being looked up (see model/clipLinks.ts). Once its clip is
  // stored, the clip itself answers the link and this row only remembers the outcome.
  clipLinks: defineTable({
    videoId: v.string(),
    status: clipLinkStatus,
    // Read from the clip's archived page, while its owner's profile is still being
    // retrieved; the clip is added to the profile once it's ready.
    waiting: v.optional(
      v.object({
        profileId: v.id('profiles'),
        clip: v.object(clipFields),
        snapshotTimestamp: v.string(),
        snapshotUrl: v.string(),
      }),
    ),
  })
    .index('by_videoId', ['videoId'])
    .index('by_waiting_profileId', ['waiting.profileId']),

  // A pasted share link (plays.tv/s/<code>) and the clip it redirected to, once known.
  shortLinks: defineTable({
    code: v.string(),
    status: clipLinkStatus,
    videoId: v.optional(v.string()),
  }).index('by_code', ['code']),

  // What visitors searched for, for the admin panel: a username, or a list of pasted clip
  // links (keyed as in model/clipLinks.ts). Whether it matched is read live from the
  // profile or links, since lookups finish after the search. Nothing about the visitor.
  searches: defineTable({
    kind: v.union(v.literal('username'), v.literal('links')),
    terms: v.array(v.string()),
  }),

  // A visitor flagging a clip. Anonymous: nothing about the reporter is kept.
  reports: defineTable({
    clipId: v.id('clips'),
    reason: reportReason,
    details: v.optional(v.string()),
    status: reportStatus,
  })
    .index('by_status', ['status'])
    .index('by_clipId_and_status', ['clipId', 'status']),

  // Clips an admin took down. They're left out of every public query.
  blacklistedClips: defineTable({
    clipId: v.id('clips'),
    profileId: v.id('profiles'),
    // The most reported violation when it was blacklisted, if it was reported.
    reason: v.optional(reportReason),
  })
    .index('by_clipId', ['clipId'])
    .index('by_profileId', ['profileId']),

  // A clip whose title contains a word of model/offensiveWords.ts, for the admin panel.
  // Added when the clip is stored and by `admin:startTitleScan`; at most one per clip.
  titleFlags: defineTable({
    clipId: v.id('clips'),
    matches: v.array(titleMatch),
    status: titleFlagStatus,
    resolvedAt: v.optional(v.number()),
  })
    .index('by_clipId', ['clipId'])
    .index('by_status', ['status']),

  // Singleton: the progress of the last scan of every title for offensive words.
  titleScans: defineTable({
    // Bumped by every new scan, so the batches of a replaced one stop.
    generation: v.number(),
    status: v.union(v.literal('running'), v.literal('done')),
    scanned: v.number(),
    // Open flags the scan added.
    flagged: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }),

  // Singleton: the home page's archive stats, recounted every 30 minutes (see
  // model/siteStats.ts). Hidden profiles and blacklisted clips aren't counted.
  siteStats: defineTable({
    ...siteStatsFields,
    updatedAt: v.number(),
  }),

  // Signed-in admin panels. Only a hash of the token is stored; each row is deleted
  // when it expires (see model/admin.ts).
  adminSessions: defineTable({
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index('by_tokenHash', ['tokenHash']),
})
