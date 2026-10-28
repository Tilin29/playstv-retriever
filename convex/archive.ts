import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import * as Archive from './model/archive'

export const reserveRequest = internalMutation({
  args: { endpoint: v.union(v.literal('cdx'), v.literal('replay')) },
  handler: async (ctx, { endpoint }) => await Archive.reserveRequest(ctx, endpoint),
})

export const pauseRequests = internalMutation({
  args: { ms: v.number() },
  handler: async (ctx, { ms }) => {
    await Archive.pauseRequests(ctx, ms)
    return null
  },
})
