import { useQuery_experimental as useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

/** Set `VITE_SERVICE_PAUSED=true` in the build to show the notice regardless of the backend. */
const FORCED = import.meta.env.VITE_SERVICE_PAUSED === 'true'

/**
 * True while the backend is unavailable. When the deployment goes over its monthly limits,
 * Convex rejects every call with a bare "Server Error", so a query that can't fail on its
 * own (`health.ping`) failing is the signal. Clears itself once the backend is back.
 */
export function useServiceUnavailable() {
  const ping = useQuery({ query: api.health.ping, args: FORCED ? 'skip' : {} })
  return FORCED || ping.status === 'error'
}
