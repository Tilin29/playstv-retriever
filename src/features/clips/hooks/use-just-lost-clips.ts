import { useEffect, useRef, useState } from 'react'
import type { Id } from '@convex/_generated/dataModel'
import { isChecking } from '../lib/status'
import type { Clip } from './use-clips'

/** How long a clip that was just found missing stays put before moving to the lost ones. */
const NOTICE_MS = 3000

/**
 * The clips whose check finished just now without finding the video. Clips that
 * were already missing when the page loaded aren't included.
 */
export function useJustLostClips(clips: Clip[] | undefined): ReadonlySet<Id<'clips'>> {
  const [previousClips, setPreviousClips] = useState(clips)
  const [justLostIds, setJustLostIds] = useState<ReadonlySet<Id<'clips'>>>(new Set())
  const timers = useRef(new Map<Id<'clips'>, ReturnType<typeof setTimeout>>())

  // Compared while rendering so a lost clip never flashes in the other section first.
  if (clips !== previousClips) {
    setPreviousClips(clips)
    const wasChecking = new Set(previousClips?.filter(isChecking).map((clip) => clip._id))
    const lostIds = (clips ?? [])
      .filter((clip) => wasChecking.has(clip._id) && clip.videoStatus === 'unavailable')
      .map((clip) => clip._id)
    if (lostIds.length > 0) setJustLostIds((ids) => new Set([...ids, ...lostIds]))
  }

  useEffect(() => {
    for (const id of justLostIds) {
      if (timers.current.has(id)) continue
      const timer = setTimeout(() => {
        timers.current.delete(id)
        setJustLostIds((ids) => new Set([...ids].filter((other) => other !== id)))
      }, NOTICE_MS)
      timers.current.set(id, timer)
    }
  }, [justLostIds])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return justLostIds
}
