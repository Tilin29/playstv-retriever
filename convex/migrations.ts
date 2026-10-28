import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { countRecoveredClips } from './model/profiles'

const BACKFILL_BATCH_SIZE = 20

/**
 * Fills in `recoveredCount` on profiles retrieved before it was tracked. Run once with
 * `npx convex run migrations:backfillRecoveredCount`; it schedules itself until done.
 */
export const backfillRecoveredCount = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('profiles')
      .paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: cursor ?? null })

    for (const profile of page) {
      if (profile.recoveredCount !== undefined) continue
      await ctx.db.patch('profiles', profile._id, {
        recoveredCount: await countRecoveredClips(ctx, profile._id),
      })
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillRecoveredCount, {
        cursor: continueCursor,
      })
    }
    return null
  },
})
