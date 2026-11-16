import { query } from './_generated/server'

/**
 * Always succeeds while the deployment is up. It reads nothing, so an error from it means
 * the backend itself is unavailable (e.g. disabled for going over the plan's monthly limits).
 */
export const ping = query({
  args: {},
  handler: async () => true,
})
