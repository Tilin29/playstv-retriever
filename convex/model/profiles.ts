import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/** Retrieved profiles, clips and their files are deleted after this long. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username)
}

/** Plays.tv (and the Wayback Machine's index) treat usernames case-insensitively. */
export function toUsernameKey(username: string) {
  return username.toLowerCase()
}

export function isExpired(profile: Doc<'profiles'>, now: number) {
  return profile._creationTime + RETENTION_MS <= now
}

export async function getProfileByUsername(ctx: QueryCtx, username: string) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_usernameKey', (q) => q.eq('usernameKey', toUsernameKey(username)))
    .unique()
}

/** The most recently retrieved profiles that were found, newest first. */
export async function listRecentProfiles(ctx: QueryCtx, limit: number) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_status', (q) => q.eq('status', 'ready'))
    .order('desc')
    .take(limit)
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
 * Re-queues clips whose recovery failed because the Archive errored (as opposed
 * to clips it simply never saved), so a later visit can still recover them.
 * Does nothing while the profile's downloads and checks are still running.
 */
export async function retryFailedClips(ctx: MutationCtx, profile: Doc<'profiles'>) {
  if (!profile.snapshotTimestamp) return
  const inProgress =
    (await clipsWithStatus(ctx, profile._id, 'mediaStatus', 'pending').first()) ??
    (await clipsWithStatus(ctx, profile._id, 'videoStatus', 'checking').first()) ??
    (await clipsWithStatus(ctx, profile._id, 'videoStatus', 'rechecking').first())
  if (inProgress) return

  const failedMedia = await clipsWithStatus(ctx, profile._id, 'mediaStatus', 'failed').take(500)
  const failedVideos = await clipsWithStatus(ctx, profile._id, 'videoStatus', 'failed').take(500)

  for (const clip of failedMedia) await ctx.db.patch('clips', clip._id, { mediaStatus: 'pending' })
  for (const clip of failedVideos) await ctx.db.patch('clips', clip._id, { videoStatus: 'checking' })
  if (failedMedia.length > 0) {
    await ctx.scheduler.runAfter(0, internal.retrieval.downloadProfileMedia, {
      profileId: profile._id,
      timestamp: profile.snapshotTimestamp,
    })
  }
  if (failedVideos.length > 0) {
    await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, {
      profileId: profile._id,
    })
  }
}

/** Deletes a profile together with its clips and every stored file. */
export async function deleteProfile(ctx: MutationCtx, profile: Doc<'profiles'>) {
  const clips = ctx.db
    .query('clips')
    .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profile._id))
  for await (const clip of clips) {
    await deleteFiles(ctx, [clip.previewStorageId, clip.thumbnailStorageId])
    await ctx.db.delete('clips', clip._id)
  }
  await deleteFiles(ctx, [profile.avatarStorageId])
  await ctx.db.delete('profiles', profile._id)
}
