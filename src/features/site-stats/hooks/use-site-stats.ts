import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type SiteStats = NonNullable<FunctionReturnType<typeof api.siteStats.get>>

/** The archive stats; null until the first recount, undefined while loading. */
export function useSiteStats() {
  return useQuery(api.siteStats.get, {})
}

const COUNT_UP_MS = 900

/**
 * Counts up from 0 to `value` when first shown, easing out; later changes show the new
 * value straight away. Skipped for people who prefer reduced motion.
 */
export function useCountUp(value: number) {
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0))

  useEffect(() => {
    if (prefersReducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const next = Math.min((now - start) / COUNT_UP_MS, 1)
      setProgress(next)
      if (next < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return progress >= 1 ? value : Math.round(value * (1 - (1 - progress) ** 3))
}

/** False on the first render, then true: lets bars grow in from zero. */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return mounted
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
