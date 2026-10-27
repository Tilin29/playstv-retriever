import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

// Retried clips are spread out so they don't hit the Archive all at once.
const CLIP_RETRY_SPACING_MS = 1_500

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

export async function deleteFiles(ctx: MutationCtx, storageIds: (Id<'_storage'> | undefined)[]) {
  for (const storageId of storageIds) {
    if (storageId) await ctx.storage.delete(storageId)
  }
}

/**
 * Re-queues clips whose recovery failed because the Archive errored (as opposed
 * to clips it simply never saved), so a later visit can still recover them.
 */
export async function retryFailedClips(ctx: MutationCtx, profileId: Id<'profiles'>) {
  const clips = ctx.db
    .query('clips')
    .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
  let retried = 0
  for await (const clip of clips) {
    if (clip.videoStatus !== 'failed') continue
    await ctx.db.patch('clips', clip._id, {
      videoStatus: 'checking',
      mediaStatus: clip.mediaStatus === 'failed' ? 'pending' : clip.mediaStatus,
    })
    await ctx.scheduler.runAfter(retried * CLIP_RETRY_SPACING_MS, internal.retrieval.recoverClip, {
      clipId: clip._id,
      cdnHost: clip.cdnHost,
      mediaId: clip.mediaId,
    })
    retried++
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
