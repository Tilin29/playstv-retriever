import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { reportClip } from './model/moderation'
import { reportReason } from './schema'

/** Flags a clip for an admin to review. */
export const create = mutation({
  args: { clipId: v.id('clips'), reason: reportReason, details: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await reportClip(ctx, args)
    return null
  },
})
