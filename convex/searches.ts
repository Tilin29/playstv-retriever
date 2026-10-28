import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { recordSearch } from './model/searches'

/**
 * Logs a search for the admin panel: a username, or the pasted links (keyed as in
 * model/clipLinks.ts). Called when a search is submitted, not on every profile visit.
 */
export const record = mutation({
  args: {
    kind: v.union(v.literal('username'), v.literal('links')),
    terms: v.array(v.string()),
  },
  handler: async (ctx, { kind, terms }) => {
    await recordSearch(ctx, kind, terms)
    return null
  },
})
