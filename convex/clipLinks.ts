import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, mutation, query } from './_generated/server'
import { archiveGate } from './model/archive'
import * as ClipLinks from './model/clipLinks'
import { clipFields } from './schema'

/**
 * Starts looking up clips by their links: a clip's page id (plays.tv/video/<id>) or
 * `s:<code>` for a share link (plays.tv/s/<code>).
 */
export const lookup = mutation({
  args: { links: v.array(v.string()) },
  handler: async (ctx, { links }) => {
    await ClipLinks.startClipLinkLookups(ctx, links)
    return null
  },
})

/** Where each link's lookup stands, in the order given, with its clip once found. */
export const list = query({
  args: { links: v.array(v.string()) },
  handler: async (ctx, { links }) => await ClipLinks.listClipLinkResults(ctx, links),
})

export const resolveShortLink = internalAction({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    let videoId: string | null
    try {
      videoId = await ClipLinks.findShortLinkTarget(archiveGate(ctx), code)
    } catch {
      await ctx.runMutation(internal.clipLinks.saveShortLink, { code, status: 'error' })
      return null
    }
    await ctx.runMutation(internal.clipLinks.saveShortLink, {
      code,
      ...(videoId ? { status: 'found', videoId } : { status: 'not_found' }),
    })
    return null
  },
})

export const saveShortLink = internalMutation({
  args: {
    code: v.string(),
    status: v.union(v.literal('found'), v.literal('not_found'), v.literal('error')),
    videoId: v.optional(v.string()),
  },
  handler: async (ctx, { code, status, videoId }) => {
    await ClipLinks.saveShortLink(
      ctx,
      code,
      status === 'found' && videoId ? { videoId } : status === 'found' ? 'not_found' : status,
    )
    return null
  },
})

export const resolve = internalAction({
  args: { videoId: v.string() },
  handler: async (ctx, { videoId }) => {
    let page: ClipLinks.ClipPage | null
    try {
      page = await ClipLinks.findClipPage(archiveGate(ctx), videoId)
    } catch {
      await ctx.runMutation(internal.clipLinks.markLink, { videoId, status: 'error' })
      return null
    }
    if (!page) {
      await ctx.runMutation(internal.clipLinks.markLink, { videoId, status: 'not_found' })
      return null
    }
    await ctx.runMutation(internal.clipLinks.saveFound, {
      videoId,
      clip: page.clip,
      ownerUsername: page.ownerUsername,
      snapshotTimestamp: page.snapshot.timestamp,
      snapshotUrl: page.snapshot.url,
    })
    return null
  },
})

export const markLink = internalMutation({
  args: { videoId: v.string(), status: v.union(v.literal('not_found'), v.literal('error')) },
  handler: async (ctx, { videoId, status }) => {
    await ClipLinks.markClipLink(ctx, videoId, status)
    return null
  },
})

export const saveFound = internalMutation({
  args: {
    videoId: v.string(),
    clip: v.object(clipFields),
    ownerUsername: v.string(),
    snapshotTimestamp: v.string(),
    snapshotUrl: v.string(),
  },
  handler: async (ctx, { videoId, clip, ownerUsername, snapshotTimestamp, snapshotUrl }) => {
    await ClipLinks.saveClipPage(ctx, videoId, {
      clip,
      ownerUsername,
      snapshot: { timestamp: snapshotTimestamp, url: snapshotUrl },
    })
    return null
  },
})
