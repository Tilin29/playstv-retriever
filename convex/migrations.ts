import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { archiveGate } from './model/archive'
import { addGames, countRecoveredClip } from './model/games'
import { parseShownDate } from './model/playstv'
import { countClips, countRecoveredClips } from './model/profiles'
import { scrapeProfile } from './retrieval'

const BACKFILL_BATCH_SIZE = 20

/**
 * Fills in `clipCount` and `recoveredCount` on ready profiles retrieved before they
 * were stored. Run once with `npx convex run migrations:backfillRecoveredCount`; it
 * schedules itself until done.
 */
export const backfillRecoveredCount = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('profiles')
      .paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: cursor ?? null })

    for (const profile of page) {
      if (profile.status !== 'ready') continue
      if (profile.clipCount === undefined) {
        await ctx.db.patch('profiles', profile._id, {
          clipCount: await countClips(ctx, profile._id),
        })
      }
      if (profile.recoveredCount === undefined) {
        await ctx.db.patch('profiles', profile._id, {
          recoveredCount: await countRecoveredClips(ctx, profile._id),
        })
      }
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillRecoveredCount, {
        cursor: continueCursor,
      })
    }
    return null
  },
})

/**
 * Fills in the game of clips retrieved before games were stored, by scraping each
 * profile's archived clip list again (the Wayback Machine, through the shared request
 * budget). One profile per run. Start it with `npx convex run migrations:backfillGames`;
 * it schedules itself until every profile was seen.
 */
export const backfillGames = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const next: {
      profile: { id: Id<'profiles'>; username: string } | null
      continueCursor: string
      isDone: boolean
    } = await ctx.runQuery(internal.migrations.nextProfileNeedingGames, { cursor: cursor ?? null })

    if (next.profile) {
      try {
        const scraped = await scrapeProfile(archiveGate(ctx), next.profile.username)
        const games = (scraped?.clips ?? []).flatMap(({ videoId, gameId, gameName }) =>
          gameId && gameName ? [{ videoId, gameId, gameName }] : [],
        )
        const updated: number = await ctx.runMutation(internal.migrations.saveClipGames, {
          profileId: next.profile.id,
          games,
        })
        console.log(`backfillGames: ${next.profile.username}: ${updated} clips got a game`)
      } catch (error) {
        // Leave this profile for a later run; carry on with the rest.
        console.error(`backfillGames: ${next.profile.username} failed`, error)
      }
    }

    if (!next.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillGames, {
        cursor: next.continueCursor,
      })
    }
    return null
  },
})

/** The next ready profile (one per page) that still has clips without a game. */
export const nextProfileNeedingGames = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('profiles')
      .paginate({ numItems: 1, cursor })
    const profile = page[0]

    let needsGames = false
    if (profile?.status === 'ready' && profile.snapshotTimestamp) {
      const clips = ctx.db
        .query('clips')
        .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profile._id))
      for await (const clip of clips) {
        if (!clip.gameId) {
          needsGames = true
          break
        }
      }
    }
    return {
      profile: needsGames ? { id: profile._id, username: profile.username } : null,
      continueCursor,
      isDone,
    }
  },
})

/** Sets the scraped game on the profile's clips that have none, and counts recovered ones. */
export const saveClipGames = internalMutation({
  args: {
    profileId: v.id('profiles'),
    games: v.array(v.object({ videoId: v.string(), gameId: v.string(), gameName: v.string() })),
  },
  handler: async (ctx, { profileId, games }) => {
    const byVideoId = new Map(games.map((game) => [game.videoId, game]))
    await addGames(ctx, games)

    let updated = 0
    const recoveredPerGame = new Map<string, number>()
    const clips = ctx.db
      .query('clips')
      .withIndex('by_profileId_and_uploadedAt', (q) => q.eq('profileId', profileId))
    for await (const clip of clips) {
      const game = byVideoId.get(clip.videoId)
      if (clip.gameId || !game) continue
      await ctx.db.patch('clips', clip._id, { gameId: game.gameId, gameName: game.gameName })
      updated++
      if (clip.videoStatus === 'available') {
        recoveredPerGame.set(game.gameId, (recoveredPerGame.get(game.gameId) ?? 0) + 1)
      }
    }
    for (const [gameId, count] of recoveredPerGame) await countRecoveredClip(ctx, gameId, count)
    return updated
  },
})

/** Earlier than any Plays.tv upload: dates before it were shown without a year. */
const MISREAD_DATES_BEFORE = Date.UTC(2014, 0, 1)

/**
 * Corrects the upload dates of clips listed without a year ("Mar 3"), which were stored
 * as 2001: they get the year of their profile's capture (see `parseShownDate`). Run once
 * with `npx convex run migrations:fixYearlessUploadDates`; it schedules itself until done.
 */
export const fixYearlessUploadDates = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('profiles')
      .paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: cursor ?? null })

    let fixed = 0
    for (const profile of page) {
      const capturedAt = profile.snapshotTimestamp
      if (!capturedAt) continue
      const clips = ctx.db
        .query('clips')
        .withIndex('by_profileId_and_uploadedAt', (q) =>
          q.eq('profileId', profile._id).gte('uploadedAt', 0).lt('uploadedAt', MISREAD_DATES_BEFORE),
        )
      for await (const clip of clips) {
        const shown = new Date(clip.uploadedAt!).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })
        const uploadedAt = parseShownDate(shown, capturedAt)
        if (uploadedAt === undefined) continue
        await ctx.db.patch('clips', clip._id, { uploadedAt })
        fixed++
      }
    }
    if (fixed > 0) console.log(`fixYearlessUploadDates: fixed ${fixed} clips`)

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.fixYearlessUploadDates, {
        cursor: continueCursor,
      })
    }
    return null
  },
})
