// The admin panel's API. Every function but `signIn` takes the session token that
// `signIn` returned and checks it before doing anything.
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, env, internalMutation, mutation, query } from './_generated/server'
import * as Admin from './model/admin'
import * as Moderation from './model/moderation'
import * as Searches from './model/searches'
import * as VideoChecks from './model/videoChecks'
import * as TitleFlags from './model/titleFlags'
import { titleFlagStatus } from './schema'

const MAX_BLACKLISTED = 200
const MAX_TITLE_FLAGS = 200
const MAX_HIDDEN_PROFILES = 200

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

/** The most recently hidden profiles. Null when not signed in. */
export const listHiddenProfiles = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await Moderation.listHiddenProfiles(ctx, MAX_HIDDEN_PROFILES)
  },
})

export const setProfileHidden = mutation({
  args: { sessionToken: v.string(), profileId: v.id('profiles'), hidden: v.boolean() },
  handler: async (ctx, { sessionToken, profileId, hidden }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await Moderation.setProfileHidden(ctx, profileId, hidden)
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

/** Clips whose full-video check failed because the Archive didn't respond. */
export const listFailedVideoChecks = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await VideoChecks.listFailedVideoChecks(ctx, VideoChecks.MAX_VIDEO_CHECKS)
  },
})

/** The given clips as they stand now, to follow their retries. */
export const getVideoChecks = query({
  args: { sessionToken: v.string(), clipIds: v.array(v.id('clips')) },
  handler: async (ctx, { sessionToken, clipIds }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await VideoChecks.getVideoChecks(ctx, clipIds)
  },
})

/** Checks every clip whose check failed again. Returns how many were queued. */
export const retryFailedVideoChecks = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    return await VideoChecks.retryFailedVideoChecks(ctx, VideoChecks.MAX_VIDEO_CHECKS)
  },
})

/** Checks one clip's full video again (one that failed or wasn't found). */
export const retryVideoCheck = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips') },
  handler: async (ctx, { sessionToken, clipId }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await VideoChecks.retryVideoCheck(ctx, clipId)
    return null
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

/** Clips whose titles contain an offensive word, newest first. Null when not signed in. */
export const listTitleFlags = query({
  args: { sessionToken: v.string(), status: titleFlagStatus },
  handler: async (ctx, { sessionToken, status }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await TitleFlags.listFlags(ctx, status, MAX_TITLE_FLAGS)
  },
})

export const setTitleFlagResolved = mutation({
  args: { sessionToken: v.string(), clipId: v.id('clips'), resolved: v.boolean() },
  handler: async (ctx, { sessionToken, clipId, resolved }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await TitleFlags.setFlagResolved(ctx, clipId, resolved)
    return null
  },
})

/** The last scan of every title. Null when not signed in or no scan ever ran. */
export const getTitleScan = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await Admin.isAdmin(ctx, sessionToken))) return null
    return await TitleFlags.getScan(ctx)
  },
})

/** Checks every stored title against the word list again, in the background. */
export const startTitleScan = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await Admin.requireAdmin(ctx, sessionToken)
    await TitleFlags.startScan(ctx)
    return null
  },
})

export const scanTitlesBatch = internalMutation({
  args: { generation: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { generation, cursor }) => {
    await TitleFlags.scanBatch(ctx, generation, cursor)
    return null
  },
})
