const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

/** "5 minutes ago", "yesterday", ... ("just now" under a minute). */
export function formatTimeAgo(timestamp: number, now: number) {
  const elapsed = now - timestamp
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return relativeFormatter.format(-Math.floor(elapsed / ms), unit)
  }
  return 'just now'
}
