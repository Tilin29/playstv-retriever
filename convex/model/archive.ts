// One request budget for the Wayback Machine, shared by every running action, so
// more users at once queue up instead of getting the whole app rate-limited.
import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { components, internal } from '../_generated/api'
import type { ActionCtx, MutationCtx } from '../_generated/server'
import { sleep, type ArchiveEndpoint, type ArchiveGate } from './wayback'

// The Archive's hard limits are roughly 30 CDX searches and 600 replays a minute
// per IP. Stay well under them; a rate-limit response still pauses everything.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  cdx: { kind: 'token bucket', rate: 20, period: MINUTE, capacity: 3, maxReserved: 10 },
  replay: { kind: 'token bucket', rate: 240, period: MINUTE, capacity: 20, maxReserved: 80 },
})

/**
 * Takes a request slot for `endpoint`: returns how long to wait before sending it,
 * and whether the slot is held (if not, the Archive is paused; ask again after waiting).
 */
export async function reserveRequest(ctx: MutationCtx, endpoint: ArchiveEndpoint) {
  const now = Date.now()
  const status = await ctx.db.query('archiveStatus').first()
  if (status && status.pausedUntil > now) {
    return { waitMs: status.pausedUntil - now, reserved: false }
  }
  const { ok, retryAfter } = await rateLimiter.limit(ctx, endpoint, { reserve: true })
  return { waitMs: retryAfter ?? 0, reserved: ok }
}

/** Holds off every Archive request for `ms`. */
export async function pauseRequests(ctx: MutationCtx, ms: number) {
  const pausedUntil = Date.now() + ms
  const status = await ctx.db.query('archiveStatus').first()
  if (!status) await ctx.db.insert('archiveStatus', { pausedUntil })
  else if (status.pausedUntil < pausedUntil) {
    await ctx.db.patch('archiveStatus', status._id, { pausedUntil })
  }
}

export function archiveGate(ctx: ActionCtx): ArchiveGate {
  return {
    async wait(endpoint) {
      for (;;) {
        const { waitMs, reserved } = await ctx.runMutation(internal.archive.reserveRequest, {
          endpoint,
        })
        if (waitMs > 0) await sleep(waitMs)
        if (reserved) return
      }
    },
    async pause(ms) {
      await ctx.runMutation(internal.archive.pauseRequests, { ms })
    },
  }
}
