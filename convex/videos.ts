import { mutation, query } from './_generated/server'
import * as Videos from './model/videos'
import { videoFields } from './schema'

export const list = query({
  args: {},
  handler: (ctx) => Videos.listVideos(ctx),
})

export const add = mutation({
  args: videoFields,
  handler: (ctx, args) => Videos.addVideo(ctx, args),
})
