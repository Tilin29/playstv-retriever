import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { deleteProfile, getProfileByUsername } from './model/profiles'

/** Maintenance: forget a username so the next lookup retrieves it from scratch. */
export const deleteProfileByUsername = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const profile = await getProfileByUsername(ctx, username)
    if (profile) await deleteProfile(ctx, profile)
    return profile !== null
  },
})
