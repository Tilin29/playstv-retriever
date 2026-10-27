import { v } from 'convex/values'
import { query } from './_generated/server'

const MAX_CLIPS = 500

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    const clips = await ctx.db
      .query('clips')
      .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
      .order('desc')
      .take(MAX_CLIPS)

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
        previewUrl: clip.previewStorageId ? await ctx.storage.getUrl(clip.previewStorageId) : null,
        thumbnailUrl: clip.thumbnailStorageId
          ? await ctx.storage.getUrl(clip.thumbnailStorageId)
          : null,
      })),
    )
  },
})
