import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type Profile = NonNullable<FunctionReturnType<typeof api.profiles.get>>

/**
 * Subscribes to a username's retrieval and starts it if needed. The lookup
 * mutation is idempotent, so re-running it (StrictMode, revisits) is safe.
 */
export function useProfile(username: string) {
  const profile = useQuery(api.profiles.get, { username })
  const lookup = useMutation(api.profiles.lookup)
  const [lookupError, setLookupError] = useState<string>()

  const startLookup = useCallback(() => {
    lookup({ username }).catch((error: unknown) => {
      setLookupError(error instanceof Error ? error.message : 'Lookup failed')
    })
  }, [lookup, username])

  useEffect(startLookup, [startLookup])

  const retry = useCallback(() => {
    setLookupError(undefined)
    startLookup()
  }, [startLookup])

  return { profile, lookupError, retry }
}
