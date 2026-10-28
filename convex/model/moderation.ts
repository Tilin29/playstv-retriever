// Reports from visitors and the blacklist admins keep. A blacklisted clip is left out
// of every public query; only the admin panel still lists it.
import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'
import type { Infer } from 'convex/values'
import { ConvexError } from 'convex/values'
import { components } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { reportReason } from '../schema'
import { adjustRecoveredCounts, createOwnerLoader, toOwnedClipView } from './clips'
import { deleteFiles } from './profiles'
import { setFlagResolved } from './titleFlags'

type ReportReason = Infer<typeof reportReason>

const MAX_DETAILS_LENGTH = 500
const MAX_OPEN_REPORTS = 500
const MAX_REPORTS_PER_CLIP = 1000

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Enough reports on one clip to get it seen; more add nothing for the admin.
  reportClip: { kind: 'token bucket', rate: 5, period: HOUR, capacity: 5 },
  // Keeps a script from flooding the admin panel.
  reportAny: { kind: 'token bucket', rate: 120, period: HOUR, capacity: 30 },
})

export async function isBlacklisted(ctx: QueryCtx, clipId: Id<'clips'>) {
  const entry = await ctx.db
    .query('blacklistedClips')
    .withIndex('by_clipId', (q) => q.eq('clipId', clipId))
    .unique()
  return entry !== null
}

/** The profile's blacklisted clips, to leave out of its clip list. */
export async function blacklistedClipIds(ctx: QueryCtx, profileId: Id<'profiles'>, limit: number) {
  const entries = await ctx.db
    .query('blacklistedClips')
    .withIndex('by_profileId', (q) => q.eq('profileId', profileId))
    .take(limit)
  return new Set(entries.map((entry) => entry.clipId))
}

/** Files a visitor's report. Only watchable, visible clips can be reported. */
export async function reportClip(
  ctx: MutationCtx,
  { clipId, reason, details }: { clipId: Id<'clips'>; reason: ReportReason; details?: string },
) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip || clip.videoStatus !== 'available' || (await isBlacklisted(ctx, clipId))) {
    throw new ConvexError('Clip not found')
  }
  const trimmed = details?.trim() ?? ''
  if (trimmed.length > MAX_DETAILS_LENGTH) {
    throw new ConvexError(`Keep the details under ${MAX_DETAILS_LENGTH} characters`)
  }
  if (reason === 'other' && !trimmed) throw new ConvexError('Say what is wrong with the clip')

  const any = await rateLimiter.limit(ctx, 'reportAny')
  if (!any.ok) throw new ConvexError('Too many reports right now. Try again later.')
  // A clip reported this often is already waiting for review, so the report is
  // dropped without telling the reporter.
  const perClip = await rateLimiter.limit(ctx, 'reportClip', { key: clipId })
  if (!perClip.ok) return

  await ctx.db.insert('reports', {
    clipId,
    reason,
    ...(trimmed && { details: trimmed }),
    status: 'open',
  })
}

function openReportsOf(ctx: QueryCtx, clipId: Id<'clips'>) {
  return ctx.db
    .query('reports')
    .withIndex('by_clipId_and_status', (q) => q.eq('clipId', clipId).eq('status', 'open'))
    .take(MAX_REPORTS_PER_CLIP)
}

async function closeReports(
  ctx: MutationCtx,
  reports: Doc<'reports'>[],
  status: 'dismissed' | 'actioned',
) {
  for (const report of reports) await ctx.db.patch('reports', report._id, { status })
}

/** The open reports, one entry per clip, most reported first. */
export async function listOpenReports(ctx: QueryCtx) {
  const reports = await ctx.db
    .query('reports')
    .withIndex('by_status', (q) => q.eq('status', 'open'))
    .order('desc')
    .take(MAX_OPEN_REPORTS)

  const byClip = new Map<Id<'clips'>, Doc<'reports'>[]>()
  for (const report of reports) {
    byClip.set(report.clipId, [...(byClip.get(report.clipId) ?? []), report])
  }

  const loadOwner = createOwnerLoader(ctx)
  const entries = await Promise.all(
    Array.from(byClip, async ([clipId, clipReports]) => {
      const clip = await ctx.db.get('clips', clipId)
      const view = clip && (await toOwnedClipView(ctx, clip, loadOwner, { revealTitle: true }))
      if (!view) return null
      return {
        clip: view,
        reportCount: clipReports.length,
        // Newest first, as the reports were read.
        lastReportedAt: clipReports[0]!._creationTime,
        reasons: countReasons(clipReports),
        reports: clipReports.map((report) => ({
          _id: report._id,
          reason: report.reason,
          details: report.details ?? null,
          reportedAt: report._creationTime,
        })),
      }
    }),
  )
  return entries
    .filter((entry) => entry !== null)
    .sort((a, b) => b.reportCount - a.reportCount || b.lastReportedAt - a.lastReportedAt)
}

/** How often each reason was given, most given first. */
function countReasons(reports: Doc<'reports'>[]) {
  const counts = new Map<ReportReason, number>()
  for (const { reason } of reports) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return Array.from(counts, ([reason, count]) => ({ reason, count })).sort(
    (a, b) => b.count - a.count,
  )
}

/**
 * Hides a clip from the public, deletes its stored preview and thumbnail, and closes
 * its open reports and title flag. The admin panel still previews it straight from the
 * Wayback Machine.
 */
export async function blacklistClip(ctx: MutationCtx, clipId: Id<'clips'>) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) throw new ConvexError('Clip not found')
  const reports = await openReportsOf(ctx, clipId)
  await closeReports(ctx, reports, 'actioned')
  await setFlagResolved(ctx, clipId, true)
  if (await isBlacklisted(ctx, clipId)) return

  const topReason = countReasons(reports)[0]?.reason
  await ctx.db.insert('blacklistedClips', {
    clipId,
    profileId: clip.profileId,
    ...(topReason && { reason: topReason }),
  })
  await deleteFiles(ctx, [clip.previewStorageId, clip.thumbnailStorageId])
  await ctx.db.patch('clips', clipId, { previewStorageId: undefined, thumbnailStorageId: undefined })
  if (clip.videoStatus === 'available') await adjustRecoveredCounts(ctx, clip, -1)
}

/** Keeps a reported clip up and closes its open reports. */
export async function dismissReports(ctx: MutationCtx, clipId: Id<'clips'>) {
  await closeReports(ctx, await openReportsOf(ctx, clipId), 'dismissed')
}

/**
 * Shows a blacklisted clip to the public again. Its media plays from the Wayback Machine
 * until the profile's next visit stores it again.
 */
export async function restoreClip(ctx: MutationCtx, clipId: Id<'clips'>) {
  const entry = await ctx.db
    .query('blacklistedClips')
    .withIndex('by_clipId', (q) => q.eq('clipId', clipId))
    .unique()
  if (!entry) return
  await ctx.db.delete('blacklistedClips', entry._id)
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) return
  // Blacklisting deleted the stored copies; 'failed' has the next visit store them again.
  if (clip.mediaStatus === 'stored') await ctx.db.patch('clips', clipId, { mediaStatus: 'failed' })
  if (clip.videoStatus === 'available') await adjustRecoveredCounts(ctx, clip, 1)
}

/** The most recently blacklisted clips. */
export async function listBlacklisted(ctx: QueryCtx, limit: number) {
  const entries = await ctx.db.query('blacklistedClips').order('desc').take(limit)
  const loadOwner = createOwnerLoader(ctx)
  const views = await Promise.all(
    entries.map(async (entry) => {
      const clip = await ctx.db.get('clips', entry.clipId)
      const view = clip && (await toOwnedClipView(ctx, clip, loadOwner, { revealTitle: true }))
      if (!view) return null
      return {
        clip: view,
        reason: entry.reason ?? null,
        blacklistedAt: entry._creationTime,
      }
    }),
  )
  return views.filter((view) => view !== null)
}

/** Hides or shows a clip's title for everyone but admins. */
export async function setTitleHidden(ctx: MutationCtx, clipId: Id<'clips'>, hidden: boolean) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) throw new ConvexError('Clip not found')
  await ctx.db.patch('clips', clipId, { titleHidden: hidden || undefined })
}

/** What the admin controls in the clip viewer need: the real title and the clip's state. */
export async function getClipModeration(ctx: QueryCtx, clipId: Id<'clips'>) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) return null
  return {
    title: clip.title,
    titleHidden: clip.titleHidden ?? false,
    blacklisted: await isBlacklisted(ctx, clipId),
  }
}