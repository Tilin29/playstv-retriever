import { v } from 'convex/values'
import { query } from './_generated/server'
import { clipMediaUrl } from './model/playstv'
import { rawCaptureUrl } from './model/wayback'

const MAX_CLIPS = 500

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get('profiles', profileId)
    const timestamp = profile?.snapshotTimestamp
    if (!timestamp) return []

    const clips = await ctx.db
      .query('clips')
      .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
      .order('desc')
      .take(MAX_CLIPS)

    // Until a copy is stored, previews play straight from the Wayback Machine
    // (unless the download already found that the Archive never saved them).
    const archived = (file: Parameters<typeof clipMediaUrl>[1], clip: (typeof clips)[number]) =>
      clip.mediaStatus === 'missing' ? null : rawCaptureUrl(timestamp, clipMediaUrl(clip, file))

    return await Promise.all(
      clips.map(async (clip) => ({
        _id: clip._id,
        title: clip.title,
        durationSeconds: clip.durationSeconds ?? null,
        uploadedAt: clip.uploadedAt ?? null,
        mediaStatus: clip.mediaStatus,
        videoStatus: clip.videoStatus,
        videoUrl: clip.videoUrl ?? null,
        videoQuality: clip.videoQuality ?? null,
        previewUrl: clip.previewStorageId
          ? await ctx.storage.getUrl(clip.previewStorageId)
          : archived('preview_144.mp4', clip),
        thumbnailUrl: clip.thumbnailStorageId
          ? await ctx.storage.getUrl(clip.thumbnailStorageId)
          : archived('480.jpg', clip),
      })),
    )
  },
})
