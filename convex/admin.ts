// The admin panel's API. Every function but `signIn` takes the session token that
// `signIn` returned and checks it before doing anything.
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, env, internalMutation, mutation, query } from './_generated/server'
import * as Admin from './model/admin'
import * as Moderation from './model/moderation'
import * as Searches from './model/searches'

const MAX_BLACKLISTED = 200

/** Exchanges the admin password for a session token. */
export const signIn = action({
  args: { password: v.string() },
  handler: async (ctx, { password }): Promise<string> => {
    await ctx.runMutation(internal.admin.takeSignInAttempt, {})
    const expected = env.ADMIN_PASSWORD
    if (!expected || !(await Admin.passwordMatches(password, expected))) {
      throw new ConvexError('Wrong password')
    }
    // Generated here rather than in the mutation, where randomness is deterministic.
    const token = Admin.newSessionToken()
    await ctx.runMutation(internal.admin.startSession, {
      tokenHash: await Admin.hashSessionToken(token),
    })
    return token
  },
})

export const takeSignInAttempt = internalMutation({
  args: {},
  handler: async (ctx) => {
    await Admin.takeSignInAttempt(ctx)
    return null
  },
})

export const startSession = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    await Admin.startSession(ctx, tokenHash)
    return null
  },
})

/** Scheduled for when a session expires. */
export const endSession = internalMutation({
  args: { sessionId: v.id('adminSessions') },
  handler: async (ctx, { sessionId }) => {
    if (await ctx.db.get('adminSessions', sessionId)) {
      await ctx.db.delete('adminSessions', sessionId)
    }
    return null
  },
})

export const signOut = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await Admin.endSessionByToken(ctx, sessionToken)
    return null
  },
})

export const isSignedIn = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => await Admin.isAdmin(ctx, sessionToken),
})

/** Clips with open reports, most reported first. Null when not signed in. */
export const listReports = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await Moderation.listOpenReports(ctx)
  },
})

/** The most recently blacklisted clips. Null when not signed in. */
export const listBlacklisted = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await Moderation.listBlacklisted(ctx, MAX_BLACKLISTED)
  },
})

export const blacklistClip = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips') },
  handler: async (ctx, { sessionToken, clipId }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await Moderation.blacklistClip(ctx, clipId)
    return null
  },
})

export const dismissReports = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips') },
  handler: async (ctx, { sessionToken, clipId }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await Moderation.dismissReports(ctx, clipId)
    return null
  },
})

export const setTitleHidden = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips'), hidden: v.boolean() },
  handler: async (ctx, { sessionToken, clipId, hidden }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await Moderation.setTitleHidden(ctx, clipId, hidden)
    return null
  },
})

/** A clip's real title and moderation state, for the viewer's admin controls. */
export const getClip = query({
  args: { sessionToken: v.string(), clipId: v.id('clips') },
  handler: async (ctx, { sessionToken, clipId }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await Moderation.getClipModeration(ctx, clipId)
  },
})

/** What visitors searched for, newest first, with what each search found. */
export const listSearches = query({
  args: { sessionToken: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, paginationOpts }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) {
      return { page: [], isDone: true, continueCursor: '' }
    }
    return await Searches.listSearches(ctx, paginationOpts)
  },
})

export const restoreClip = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips') },
  handler: async (ctx, { sessionToken, clipId }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await Moderation.restoreClip(ctx, clipId)
    return null
  },
})
