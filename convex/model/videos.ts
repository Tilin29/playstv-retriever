import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { videoFields } from '../schema'

const newVideo = v.object(videoFields)
export type NewVideo = Infer<typeof newVideo>

export async function listVideos(ctx: QueryCtx) {
  return await ctx.db.query('videos').order('desc').collect()
}

export async function addVideo(ctx: MutationCtx, video: NewVideo) {
  const existing = await ctx.db
    .query('videos')
    .withIndex('by_url', (q) => q.eq('url', video.url))
    .unique()
  if (existing) return existing._id
  return await ctx.db.insert('videos', video)
}
