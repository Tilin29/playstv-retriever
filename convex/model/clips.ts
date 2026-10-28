import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { clipMediaUrl } from './playstv'
import { rawCaptureUrl } from './wayback'

/**
 * Checks one clip's full video again after the Archive didn't respond the first time.
 * Only allowed for clips whose check failed.
 */
export async function retryClipVideo(ctx: MutationCtx, clipId: Id<'clips'>) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) throw new ConvexError('Clip not found')
  if (clip.videoStatus !== 'failed') throw new ConvexError("This clip's check didn't fail")

  await ctx.db.patch('clips', clipId, { videoStatus: 'checking' })
  await ctx.scheduler.runAfter(0, internal.retrieval.checkOneClipVideo, { clipId })
}

/** What the app shows of a clip. `timestamp` is its profile's snapshot. */
export async function toClipView(ctx: QueryCtx, clip: Doc<'clips'>, timestamp: string) {
  // Until a copy is stored, previews play straight from the Wayback Machine
  // (unless the download already found that the Archive never saved them).
  const archived = (file: Parameters<typeof clipMediaUrl>[1]) =>
    clip.mediaStatus === 'missing' ? null : rawCaptureUrl(timestamp, clipMediaUrl(clip, file))

  return {
    _id: clip._id,
    title: clip.title,
    durationSeconds: clip.durationSeconds ?? null,
    uploadedAt: clip.uploadedAt ?? null,
    gameName: clip.gameName ?? null,
    mediaStatus: clip.mediaStatus,
    videoStatus: clip.videoStatus,
    videoUrl: clip.videoUrl ?? null,
    videoQuality: clip.videoQuality ?? null,
    previewUrl: clip.previewStorageId
      ? await ctx.storage.getUrl(clip.previewStorageId)
      : archived('preview_144.mp4'),
    thumbnailUrl: clip.thumbnailStorageId
      ? await ctx.storage.getUrl(clip.thumbnailStorageId)
      : archived('480.jpg'),
  }
}
