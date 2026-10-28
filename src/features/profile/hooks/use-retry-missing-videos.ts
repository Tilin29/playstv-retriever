import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

/** Re-queues the full-video checks of a profile's clips that weren't found. */
export function useRetryMissingVideos(profileId: Id<'profiles'>) {
  const retryMissingVideos = useMutation(api.profiles.retryMissingVideos)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function retry() {
    setPending(true)
    setError(undefined)
    try {
      await retryMissingVideos({ profileId })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : "Couldn't start the search")
    } finally {
      setPending(false)
    }
  }

  return { retry, pending, error }
}
