// Admin sign-in: one shared password (the ADMIN_PASSWORD env var) exchanges for a
// random session token. The client keeps the token and passes it to every admin
// function; only its SHA-256 hash is stored, so the table never holds a usable token.
import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components, internal } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'

const SESSION_MS = 7 * 24 * HOUR

// Every sign-in attempt shares one budget, since functions can't see who's calling.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  adminSignIn: { kind: 'token bucket', rate: 10, period: 15 * MINUTE, capacity: 5 },
})

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(digest)
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Compares in constant time, so the response time doesn't leak how much matched. */
export async function passwordMatches(password: string, expected: string) {
  const [a, b] = await Promise.all([sha256(password), sha256(expected)])
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!
  return difference === 0
}

/** A new random session token. Only call from an action, where randomness is real. */
export function newSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function hashSessionToken(token: string) {
  return toHex(await sha256(token))
}

/** Takes one sign-in attempt; throws when there were too many recently. */
export async function takeSignInAttempt(ctx: MutationCtx) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, 'adminSignIn')
  if (!ok) {
    const minutes = Math.ceil((retryAfter ?? MINUTE) / MINUTE)
    throw new ConvexError(`Too many attempts. Try again in ${minutes} min.`)
  }
}

/** Stores a session for the token's hash; it's deleted once it expires. */
export async function startSession(ctx: MutationCtx, tokenHash: string) {
  const expiresAt = Date.now() + SESSION_MS
  const sessionId = await ctx.db.insert('adminSessions', { tokenHash, expiresAt })
  await ctx.scheduler.runAt(expiresAt, internal.admin.endSession, { sessionId })
}

async function getSession(ctx: QueryCtx, sessionToken: string) {
  const tokenHash = await hashSessionToken(sessionToken)
  return await ctx.db
    .query('adminSessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .unique()
}

/** Whether the token belongs to a live session. Expired sessions are already deleted. */
export async function isAdmin(ctx: QueryCtx, sessionToken: string) {
  return (await getSession(ctx, sessionToken)) !== null
}

/** Throws unless the token belongs to a live session. */
export async function requireAdmin(ctx: MutationCtx, sessionToken: string) {
  const session = await getSession(ctx, sessionToken)
  if (!session || session.expiresAt <= Date.now()) throw new ConvexError('Not signed in')
}

export async function endSessionByToken(ctx: MutationCtx, sessionToken: string) {
  const session = await getSession(ctx, sessionToken)
  if (session) await ctx.db.delete('adminSessions', session._id)
}
