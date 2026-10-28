// Clips whose titles contain a word of model/offensiveWords.ts, for admins to review.
// A clip is checked when it's stored; a scan checks every stored title again (e.g. after
// the word list changed). A flag an admin resolved stays resolved through every scan.
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createOwnerLoader, toOwnedClipView } from './clips'
import { findOffensiveWords, type OffensiveMatch } from './offensiveWords'

const SCAN_BATCH_SIZE = 200

function getFlag(ctx: QueryCtx, clipId: Id<'clips'>) {
  return ctx.db
    .query('titleFlags')
    .withIndex('by_clipId', (q) => q.eq('clipId', clipId))
    .unique()
}

/** Flags a clip that was just stored, if its title has an offensive word. */
export async function flagNewClip(ctx: MutationCtx, clipId: Id<'clips'>, title: string) {
  const matches = findOffensiveWords(title)
  if (matches.length > 0) await ctx.db.insert('titleFlags', { clipId, matches, status: 'open' })
}

/**
 * Brings a clip's flag in line with the current word list: adds one, updates what an open
 * one matched, or deletes an open one that no longer matches. Returns whether it added one.
 */
async function checkTitle(ctx: MutationCtx, clipId: Id<'clips'>, title: string) {
  const matches = findOffensiveWords(title)
  const flag = await getFlag(ctx, clipId)
  if (!flag) {
    if (matches.length === 0) return false
    await ctx.db.insert('titleFlags', { clipId, matches, status: 'open' })
    return true
  }
  if (flag.status === 'resolved') return false
  if (matches.length === 0) {
    await ctx.db.delete('titleFlags', flag._id)
  } else if (!sameMatches(flag.matches, matches)) {
    await ctx.db.patch('titleFlags', flag._id, { matches })
  }
  return false
}

function sameMatches(a: OffensiveMatch[], b: OffensiveMatch[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The newest flags with the given status, with their clips. */
export async function listFlags(ctx: QueryCtx, status: 'open' | 'resolved', limit: number) {
  const flags = await ctx.db
    .query('titleFlags')
    .withIndex('by_status', (q) => q.eq('status', status))
    .order('desc')
    .take(limit)
  const loadOwner = createOwnerLoader(ctx)
  const entries = await Promise.all(
    flags.map(async (flag) => {
      const clip = await ctx.db.get('clips', flag.clipId)
      const view = clip && (await toOwnedClipView(ctx, clip, loadOwner, { revealTitle: true }))
      if (!view) return null
      return {
        clip: view,
        matches: flag.matches,
        flaggedAt: flag._creationTime,
        resolvedAt: flag.resolvedAt ?? null,
      }
    }),
  )
  return entries.filter((entry) => entry !== null)
}

/** Marks a clip's flag resolved (or open again). Does nothing when it has none. */
export async function setFlagResolved(ctx: MutationCtx, clipId: Id<'clips'>, resolved: boolean) {
  const flag = await getFlag(ctx, clipId)
  if (!flag || (flag.status === 'resolved') === resolved) return
  await ctx.db.patch(
    'titleFlags',
    flag._id,
    resolved
      ? { status: 'resolved', resolvedAt: Date.now() }
      : { status: 'open', resolvedAt: undefined },
  )
}

export async function deleteFlag(ctx: MutationCtx, clipId: Id<'clips'>) {
  const flag = await getFlag(ctx, clipId)
  if (flag) await ctx.db.delete('titleFlags', flag._id)
}

/** The last scan's progress, or null when no scan ever ran. */
export async function getScan(ctx: QueryCtx) {
  const scan = await ctx.db.query('titleScans').first()
  if (!scan) return null
  return {
    status: scan.status,
    scanned: scan.scanned,
    flagged: scan.flagged,
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt ?? null,
  }
}

/** Starts checking every stored title, replacing a scan that's still running. */
export async function startScan(ctx: MutationCtx) {
  const scan = await ctx.db.query('titleScans').first()
  const generation = (scan?.generation ?? 0) + 1
  const fields = {
    generation,
    status: 'running' as const,
    scanned: 0,
    flagged: 0,
    startedAt: Date.now(),
  }
  if (scan) await ctx.db.replace('titleScans', scan._id, fields)
  else await ctx.db.insert('titleScans', fields)
  await ctx.scheduler.runAfter(0, internal.admin.scanTitlesBatch, { generation, cursor: null })
}

/** Checks one batch of titles, then schedules the next until every clip was seen. */
export async function scanBatch(ctx: MutationCtx, generation: number, cursor: string | null) {
  const scan = await ctx.db.query('titleScans').first()
  // A newer scan replaced this one.
  if (!scan || scan.generation !== generation || scan.status !== 'running') return

  const { page, isDone, continueCursor } = await ctx.db
    .query('clips')
    .paginate({ numItems: SCAN_BATCH_SIZE, cursor })
  let flagged = 0
  for (const clip of page) {
    if (await checkTitle(ctx, clip._id, clip.title)) flagged++
  }
  await ctx.db.patch('titleScans', scan._id, {
    scanned: scan.scanned + page.length,
    flagged: scan.flagged + flagged,
    ...(isDone && { status: 'done' as const, finishedAt: Date.now() }),
  })
  if (!isDone) {
    await ctx.scheduler.runAfter(0, internal.admin.scanTitlesBatch, {
      generation,
      cursor: continueCursor,
    })
  }
}
