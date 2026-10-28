import type { PaginationOptions } from 'convex/server'
import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { deleteFlag } from './titleFlags'

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username)
}

/** Plays.tv (and the Wayback Machine's index) treat usernames case-insensitively. */
export function toUsernameKey(username: string) {
  return username.toLowerCase()
}

/** Whether an admin hid the profile, leaving it and its clips out of every public query. */
export function isProfileHidden(profile: Doc<'profiles'>) {
  return profile.hiddenAt !== undefined
}

export async function getProfileByUsername(ctx: QueryCtx, username: string) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_usernameKey', (q) => q.eq('usernameKey', toUsernameKey(username)))
    .unique()
}

/**
 * Starts retrieving a username from the Wayback Machine. A failed lookup (`existing`)
 * stored nothing, so it starts over on the same row.
 */
export async function startProfileLookup(
  ctx: MutationCtx,
  username: string,
  existing: Doc<'profiles'> | null,
) {
  let profileId = existing?._id
  if (profileId) {
    await ctx.db.patch('profiles', profileId, { username, status: 'searching', error: undefined })
  } else {
    profileId = await ctx.db.insert('profiles', {
      usernameKey: toUsernameKey(username),
      username,
      status: 'searching',
    })
  }
  await ctx.scheduler.runAfter(0, internal.retrieval.retrieveProfile, { profileId, username })
  return profileId
}

// Profiles whose usernames start with a prefix include ones with no recovered clips,
// which are skipped, so a few more are read than are returned.
const PREFIX_READ_FACTOR = 5

/** Profiles with recovered clips whose username starts with `prefix`, alphabetically. */
export async function searchProfilesWithRecoveredClips(
  ctx: QueryCtx,
  prefix: string,
  limit: number,
) {
  const key = toUsernameKey(prefix)
  const profiles = await ctx.db
    .query('profiles')
    .withIndex('by_usernameKey', (q) => q.gte('usernameKey', key).lt('usernameKey', `${key}￿`))
    .take(limit * PREFIX_READ_FACTOR)
  return profiles
    .filter(
      (profile) =>
        profile.status === 'ready' &&
        (profile.recoveredCount ?? 0) > 0 &&
        !isProfileHidden(profile),
    )
    .slice(0, limit)
}

/** The most recently retrieved profiles that were found and aren't hidden, newest first. */
export async function listRecentProfiles(ctx: QueryCtx, paginationOpts: PaginationOptions) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_status', (q) => q.eq('status', 'ready'))
    .order('desc')
    .filter((q) => q.eq(q.field('hiddenAt'), undefined))
    .paginate(paginationOpts)
}

/** How many of the profile's clips have a full-length video, counted from the clips. */
export async function countRecoveredClips(ctx: QueryCtx, profileId: Id<'profiles'>) {
  let count = 0
  for await (const _clip of clipsWithStatus(ctx, profileId, 'videoStatus', 'available')) count++
  return count
}

/** How many clips the profile has, counted from the clips. */
export async function countClips(ctx: QueryCtx, profileId: Id<'profiles'>) {
  let count = 0
  const clips = ctx.db
    .query('clips')
    .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
  for await (const _clip of clips) count++
  return count
}

export async function deleteFiles(ctx: MutationCtx, storageIds: (Id<'_storage'> | undefined)[]) {
  for (const storageId of storageIds) {
    if (storageId) await ctx.storage.delete(storageId)
  }
}

function clipsWithStatus(
  ctx: QueryCtx,
  profileId: Id<'profiles'>,
  field: 'mediaStatus' | 'videoStatus',
  status: Doc<'clips'>['mediaStatus'] | Doc<'clips'>['videoStatus'],
) {
  if (field === 'mediaStatus') {
    return ctx.db
      .query('clips')
      .withIndex('by_profileId_and_mediaStatus', (q) =>
        q.eq('profileId', profileId).eq('mediaStatus', status as Doc<'clips'>['mediaStatus']),
      )
  }
  return ctx.db
    .query('clips')
    .withIndex('by_profileId_and_videoStatus', (q) =>
      q.eq('profileId', profileId).eq('videoStatus', status as Doc<'clips'>['videoStatus']),
    )
}

/**
 * Re-queues previews and thumbnails whose download failed because the Archive
 * errored (or whose copies an earlier version deleted after 30 days), so a later
 * visit can still store them. Full-video checks only run on the first pass. Does
 * nothing while the profile's downloads are still running.
 */
export async function retryFailedMedia(ctx: MutationCtx, profile: Doc<'profiles'>) {
  if (!profile.snapshotTimestamp) return
  if (await clipsWithStatus(ctx, profile._id, 'mediaStatus', 'pending').first()) return

  const failedMedia = [
    ...(await clipsWithStatus(ctx, profile._id, 'mediaStatus', 'failed').take(500)),
    ...(await clipsWithStatus(ctx, profile._id, 'mediaStatus', 'expired').take(500)),
  ]
  for (const clip of failedMedia) await ctx.db.patch('clips', clip._id, { mediaStatus: 'pending' })
  if (failedMedia.length > 0) {
    await ctx.scheduler.runAfter(0, internal.retrieval.downloadProfileMedia, {
      profileId: profile._id,
      timestamp: profile.snapshotTimestamp,
    })
  }
}

/**
 * Looks for the full videos of clips that weren't found (or whose check failed) once
 * more. Only allowed after every clip has been checked.
 */
export async function retryMissingVideos(ctx: MutationCtx, profile: Doc<'profiles'>) {
  for (const status of ['checking', 'rechecking'] as const) {
    if (await clipsWithStatus(ctx, profile._id, 'videoStatus', status).first()) {
      throw new ConvexError('Still checking for full videos')
    }
  }

  const missing = [
    ...(await clipsWithStatus(ctx, profile._id, 'videoStatus', 'unavailable').take(500)),
    ...(await clipsWithStatus(ctx, profile._id, 'videoStatus', 'failed').take(500)),
  ]
  for (const clip of missing) await ctx.db.patch('clips', clip._id, { videoStatus: 'checking' })
  if (missing.length > 0) {
    await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, {
      profileId: profile._id,
    })
  }
}

/** Maintenance only: deletes a profile together with its clips and every stored file. */
export async function deleteProfile(ctx: MutationCtx, profile: Doc<'profiles'>) {
  const clips = ctx.db
    .query('clips')
    .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profile._id))
  for await (const clip of clips) {
    await deleteFiles(ctx, [clip.previewStorageId, clip.thumbnailStorageId])
    await ctx.db.delete('clips', clip._id)
    await deleteFlag(ctx, clip._id)
  }
  await deleteFiles(ctx, [profile.avatarStorageId])
  await ctx.db.delete('profiles', profile._id)
}
