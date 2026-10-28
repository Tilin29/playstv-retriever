import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

/** Checks one clip's full video again after the Archive didn't respond. */
export function useRetryClipVideo(clipId: Id<'clips'>) {
  const retryVideo = useMutation(api.clips.retryVideo)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function retry() {
    setPending(true)
    setError(undefined)
    try {
      await retryVideo({ clipId })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : "Couldn't try again")
    } finally {
      setPending(false)
    }
  }

  return { retry, pending, error }
}
