import { useState } from 'react'
import type { Id } from '@convex/_generated/dataModel'
import { readShuffle, writeShuffle } from '../lib/player-settings'

export type ShuffleState = ReturnType<typeof useShuffle>

/**
 * Whether the viewer shuffles, and the clips played since it was turned on (in order),
 * which "previous" walks back through.
 */
export function useShuffle(openClipId: Id<'clips'> | undefined) {
  const [shuffle, setShuffleState] = useState(readShuffle)
  // Fixes the random order until shuffle is turned on again.
  const [seed, setSeed] = useState(randomSeed)
  const [history, setHistory] = useState<Id<'clips'>[]>([])

  if (shuffle && openClipId && !history.includes(openClipId)) {
    setHistory([...history, openClipId])
  } else if (!openClipId && history.length > 0) {
    // Closing the viewer starts the next session afresh.
    setHistory([])
  }

  const setShuffle = (on: boolean) => {
    writeShuffle(on)
    setShuffleState(on)
    setSeed(randomSeed())
    setHistory(on && openClipId ? [openClipId] : [])
  }

  return {
    shuffle,
    setShuffle,
    history,
    /** 0 to 1, different for each clip played: what picks the next one. */
    stepSeed: openClipId ? hash(seed, openClipId) / 2 ** 32 : 0,
  }
}

/**
 * The open clip and the ones the viewer steps to from it. In order, those are its
 * neighbours in `clips`. Shuffled, "next" is a random clip not yet played (`randomNext`
 * when given: one picked elsewhere, null while there's none), and "previous" walks back
 * through the played ones. `extraClips` are clips outside `clips` that may be open, such
 * as earlier random picks.
 */
export function clipSteps<T extends { _id: Id<'clips'> }>(
  clips: T[],
  openClipId: Id<'clips'> | undefined,
  { shuffle, history, stepSeed }: ShuffleState,
  { randomNext, extraClips = [] }: { randomNext?: T | null; extraClips?: T[] } = {},
) {
  const byId = (id: Id<'clips'> | undefined) =>
    clips.find((clip) => clip._id === id) ?? extraClips.find((clip) => clip._id === id) ?? null
  const openIndex = clips.findIndex((clip) => clip._id === openClipId)
  const openClip = byId(openClipId)

  if (!shuffle || !openClip) {
    return {
      openClip,
      previous: openIndex > 0 ? (clips[openIndex - 1] ?? null) : null,
      next: openIndex >= 0 ? (clips[openIndex + 1] ?? null) : null,
    }
  }

  const historyIndex = history.indexOf(openClip._id)
  // After stepping back, "next" replays the clips that came after.
  if (historyIndex < history.length - 1) {
    return {
      openClip,
      previous: historyIndex > 0 ? byId(history[historyIndex - 1]) : null,
      next: byId(history[historyIndex + 1]),
    }
  }
  const played = new Set(history)
  const unplayed = clips.filter((clip) => !played.has(clip._id))
  return {
    openClip,
    previous: historyIndex > 0 ? byId(history[historyIndex - 1]) : null,
    next:
      randomNext !== undefined
        ? randomNext
        : (unplayed[Math.floor(stepSeed * unplayed.length)] ?? null),
  }
}

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32)
}

/** FNV-1a of the id, mixed with `seed`, so the pick stays put across renders. */
function hash(seed: number, id: string) {
  let value = (2166136261 ^ seed) >>> 0
  for (let index = 0; index < id.length; index++) {
    value = Math.imul(value ^ id.charCodeAt(index), 16777619) >>> 0
  }
  return value
}
