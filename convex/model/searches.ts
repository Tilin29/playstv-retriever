// A log of what visitors searched for, shown in the admin panel with whether each search
// found anything. Only the search terms are kept, nothing about who searched.
import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import type { PaginationOptions } from 'convex/server'
import { ConvexError } from 'convex/values'
import { components } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { clipLinkStatus, isValidLinkKey, MAX_CLIP_LINKS } from './clipLinks'
import { getProfileByUsername, isValidUsername } from './profiles'

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Keeps a script from flooding the log; real visitors never come close.
  recordSearch: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 60 },
})

export async function recordSearch(
  ctx: MutationCtx,
  kind: Doc<'searches'>['kind'],
  terms: string[],
) {
  const valid =
    kind === 'username'
      ? terms.length === 1 && isValidUsername(terms[0]!)
      : terms.length > 0 && terms.length <= MAX_CLIP_LINKS && terms.every(isValidLinkKey)
  if (!valid) throw new ConvexError('Invalid search')
  // Over the limit, the search still runs; it just isn't logged.
  const { ok } = await rateLimiter.limit(ctx, 'recordSearch')
  if (ok) await ctx.db.insert('searches', { kind, terms })
}

/** The most recent searches first, each with what it found so far. */
export async function listSearches(ctx: QueryCtx, paginationOpts: PaginationOptions) {
  const result = await ctx.db.query('searches').order('desc').paginate(paginationOpts)
  const page = await Promise.all(
    result.page.map(async (search) => {
      const base = { _id: search._id, searchedAt: search._creationTime }
      if (search.kind === 'username') {
        const username = search.terms[0] ?? ''
        const profile = await getProfileByUsername(ctx, username)
        return {
          ...base,
          kind: 'username' as const,
          username,
          // The profile's state now: a lookup still running counts as searching.
          status: profile?.status ?? ('searching' as const),
          usernameKey: profile?.usernameKey ?? null,
          clipCount: profile?.clipCount ?? null,
          recoveredCount: profile?.recoveredCount ?? null,
        }
      }
      const statuses = await Promise.all(search.terms.map((key) => clipLinkStatus(ctx, key)))
      return {
        ...base,
        kind: 'links' as const,
        links: search.terms.map((key, index) => ({ key, status: statuses[index]! })),
      }
    }),
  )
  return { ...result, page }
}
