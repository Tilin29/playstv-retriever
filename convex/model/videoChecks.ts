// Clips whose full-video check failed because the Archive didn't respond, for admins to
// check again. A retried clip goes back to 'checking' and through the usual check.
import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createOwnerLoader, toOwnedClipView } from './clips'

export const MAX_VIDEO_CHECKS = 500

/** Clips whose check failed, most recently retrieved first. */
export async function listFailedVideoChecks(ctx: QueryCtx, limit: number) {
  const clips = await ctx.db
    .query('clips')
    .withIndex('by_videoStatus', (q) => q.eq('videoStatus', 'failed'))
    .order('desc')
    .take(limit)
  return await toViews(ctx, clips)
}

/** The given clips as they stand now, so an admin can follow their retries. */
export async function getVideoChecks(ctx: QueryCtx, clipIds: Id<'clips'>[]) {
  const clips = await Promise.all(
    clipIds.slice(0, MAX_VIDEO_CHECKS).map((clipId) => ctx.db.get('clips', clipId)),
  )
  return await toViews(ctx, clips.filter((clip) => clip !== null))
}

async function toViews(ctx: QueryCtx, clips: Doc<'clips'>[]) {
  const loadOwner = createOwnerLoader(ctx)
  const views = await Promise.all(
    clips.map((clip) => toOwnedClipView(ctx, clip, loadOwner, { revealTitle: true, includeHiddenProfile: true })),
  )
  return views.filter((view) => view !== null)
}

/**
 * Checks every clip whose check failed again (up to `limit` at a time). Each profile's
 * clips run through one profile-wide check, which keeps the Archive requests in step.
 * Returns how many were queued.
 */
export async function retryFailedVideoChecks(ctx: MutationCtx, limit: number) {
  const clips = await ctx.db
    .query('clips')
    .withIndex('by_videoStatus', (q) => q.eq('videoStatus', 'failed'))
    .take(limit)
  const profileIds = new Set<Id<'profiles'>>()
  for (const clip of clips) {
    await ctx.db.patch('clips', clip._id, { videoStatus: 'checking' })
    profileIds.add(clip.profileId)
  }
  for (const profileId of profileIds) {
    await ctx.scheduler.runAfter(0, internal.retrieval.checkProfileVideos, { profileId })
  }
  return clips.length
}

/**
 * Checks one clip's full video again. Clips already found aren't re-checked: going back
 * through 'checking' would count them as recovered a second time.
 */
export async function retryVideoCheck(ctx: MutationCtx, clipId: Id<'clips'>) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) throw new ConvexError('Clip not found')
  if (clip.videoStatus !== 'failed' && clip.videoStatus !== 'unavailable') {
    throw new ConvexError(
      clip.videoStatus === 'available' ? 'This clip was already found' : 'Already checking',
    )
  }
  await ctx.db.patch('clips', clipId, { videoStatus: 'checking' })
  await ctx.scheduler.runAfter(0, internal.retrieval.checkOneClipVideo, { clipId })
}
