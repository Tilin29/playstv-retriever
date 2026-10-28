// The home page's archive stats. Counting every profile and clip on each visit would
// read the whole database, so a cron recounts them in batches (profiles, then clips)
// and stores the result in one document that the home page reads.
import type { Infer } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { siteStatsFields, yearCount } from '../schema'
import { isBlacklisted } from './moderation'
import { isProfileHidden } from './profiles'

type YearCount = Infer<typeof yearCount>
export type SiteStatsTotals = {
  [K in keyof typeof siteStatsFields]: Infer<(typeof siteStatsFields)[K]>
}

const BATCH_SIZE = 500
const MAX_TOP_GAMES = 5
/** No clip was uploaded to Plays.tv before this, so earlier upload dates were misread. */
const FIRST_PLAYSTV_YEAR = 2014

const EMPTY_TOTALS: SiteStatsTotals = {
  usernamesSearched: 0,
  profilesFound: 0,
  clipsFound: 0,
  clipsRecovered: 0,
  byYear: [],
}

export async function startRecount(ctx: MutationCtx) {
  await ctx.scheduler.runAfter(0, internal.siteStats.recountBatch, {
    phase: 'profiles',
    cursor: null,
    totals: EMPTY_TOTALS,
  })
}

/**
 * Counts one batch of profiles or clips into `totals`, then schedules the next batch,
 * or stores the totals once every clip was counted.
 */
export async function recountBatch(
  ctx: MutationCtx,
  phase: 'profiles' | 'clips',
  cursor: string | null,
  totals: SiteStatsTotals,
) {
  const next = { ...totals, byYear: totals.byYear.map((entry) => ({ ...entry })) }
  let isDone: boolean
  let continueCursor: string

  if (phase === 'profiles') {
    const result = await ctx.db
      .query('profiles')
      .paginate({ numItems: BATCH_SIZE, cursor })
    for (const profile of result.page) {
      if (isProfileHidden(profile)) continue
      if (profile.status === 'ready') next.profilesFound++
      if (profile.status === 'ready' || profile.status === 'not_found') next.usernamesSearched++
    }
    ;({ isDone, continueCursor } = result)
  } else {
    const result = await ctx.db.query('clips').paginate({ numItems: BATCH_SIZE, cursor })
    const hiddenProfiles = new Map<Id<'profiles'>, boolean>()
    for (const clip of result.page) {
      if (await isOwnerHidden(ctx, clip, hiddenProfiles)) continue
      if (await isBlacklisted(ctx, clip._id)) continue
      countClip(next, clip)
    }
    ;({ isDone, continueCursor } = result)
  }

  if (!isDone) {
    await ctx.scheduler.runAfter(0, internal.siteStats.recountBatch, {
      phase,
      cursor: continueCursor,
      totals: next,
    })
  } else if (phase === 'profiles') {
    await ctx.scheduler.runAfter(0, internal.siteStats.recountBatch, {
      phase: 'clips',
      cursor: null,
      totals: next,
    })
  } else {
    await saveStats(ctx, next)
  }
}

async function isOwnerHidden(
  ctx: QueryCtx,
  clip: Doc<'clips'>,
  cache: Map<Id<'profiles'>, boolean>,
) {
  let hidden = cache.get(clip.profileId)
  if (hidden === undefined) {
    const profile = await ctx.db.get('profiles', clip.profileId)
    hidden = !profile || isProfileHidden(profile)
    cache.set(clip.profileId, hidden)
  }
  return hidden
}

function countClip(totals: SiteStatsTotals, clip: Doc<'clips'>) {
  const recovered = clip.videoStatus === 'available' ? 1 : 0
  totals.clipsFound++
  totals.clipsRecovered += recovered
  if (clip.uploadedAt === undefined) return
  const year = new Date(clip.uploadedAt).getUTCFullYear()
  // Lists show this year's clips without a year ("Mar 3"), which parses as 2001.
  if (year < FIRST_PLAYSTV_YEAR) return

  let entry: YearCount | undefined = totals.byYear.find((candidate) => candidate.year === year)
  if (!entry) {
    entry = { year, found: 0, recovered: 0 }
    totals.byYear.push(entry)
    totals.byYear.sort((a, b) => a.year - b.year)
  }
  entry.found++
  entry.recovered += recovered
}

async function saveStats(ctx: MutationCtx, totals: SiteStatsTotals) {
  const existing = await ctx.db.query('siteStats').first()
  const stats = { ...totals, updatedAt: Date.now() }
  if (existing) await ctx.db.replace('siteStats', existing._id, stats)
  else await ctx.db.insert('siteStats', stats)
}

/** The last recount, with the games that have the most recovered clips right now. */
export async function getSiteStats(ctx: QueryCtx) {
  const stats = await ctx.db.query('siteStats').first()
  if (!stats) return null
  const topGames = await ctx.db
    .query('games')
    .withIndex('by_recoveredCount', (q) => q.gt('recoveredCount', 0))
    .order('desc')
    .take(MAX_TOP_GAMES)
  return {
    usernamesSearched: stats.usernamesSearched,
    profilesFound: stats.profilesFound,
    clipsFound: stats.clipsFound,
    clipsRecovered: stats.clipsRecovered,
    byYear: stats.byYear,
    updatedAt: stats.updatedAt,
    topGames: topGames.map((game) => ({
      gameId: game.gameId,
      name: game.name,
      recoveredCount: game.recoveredCount,
    })),
  }
}
