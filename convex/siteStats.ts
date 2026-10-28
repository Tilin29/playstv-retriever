import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import * as SiteStats from './model/siteStats'
import { siteStatsFields } from './schema'

/** The home page's archive stats. Null until the first recount finished. */
export const get = query({
  args: {},
  handler: async (ctx) => await SiteStats.getSiteStats(ctx),
})

/** Run by the cron. */
export const recount = internalMutation({
  args: {},
  handler: async (ctx) => {
    await SiteStats.startRecount(ctx)
    return null
  },
})

export const recountBatch = internalMutation({
  args: {
    phase: v.union(v.literal('profiles'), v.literal('clips')),
    cursor: v.union(v.string(), v.null()),
    totals: v.object(siteStatsFields),
  },
  handler: async (ctx, { phase, cursor, totals }) => {
    await SiteStats.recountBatch(ctx, phase, cursor, totals)
    return null
  },
})
