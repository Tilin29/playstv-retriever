import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'

export type ClipLinkResult = FunctionReturnType<typeof api.clipLinks.list>[number]
export type FoundClip = NonNullable<ClipLinkResult['clip']>

/**
 * Looks up the clips behind the link `keys` (see parseClipLinks) and follows their
 * progress. Starting a lookup is idempotent, so a shared or reloaded results page simply
 * picks up where it was.
 */
export function useClipLinks(keys: string[]) {
  const lookup = useMutation(api.clipLinks.lookup)
  const results = useQuery(api.clipLinks.list, keys.length > 0 ? { links: keys } : 'skip')
  // Kept with the links it's about, so looking up other links clears it.
  const [failed, setFailed] = useState<{ key: string; message: string }>()
  const key = keys.join(',')

  useEffect(() => {
    if (!key) return
    lookup({ links: key.split(',') }).catch((caught: unknown) => {
      const message =
        caught instanceof ConvexError ? String(caught.data) : "Couldn't start the lookup"
      setFailed({ key, message })
    })
  }, [key, lookup])

  return { results, error: failed?.key === key ? failed.message : undefined }
}
