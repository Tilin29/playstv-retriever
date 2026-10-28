import { cn } from '@/lib/utils'
import { formatRecoveredPercent } from '../lib/format'

/** Below 30% recovered is bad, from 60% on is good. */
function ringColor(share: number) {
  if (share >= 0.6) return 'stroke-success'
  if (share >= 0.3) return 'stroke-warning'
  return 'stroke-destructive'
}

/**
 * A ring that fills up with the share of clips whose full video was recovered,
 * with the percentage and "found" in the middle. The text scales with the
 * ring's font size.
 */
export function RecoveredRing({
  recovered,
  total,
  className,
}: {
  recovered: number
  total: number
  className?: string
}) {
  const share = total > 0 ? Math.min(recovered / total, 1) : 0
  const percent = formatRecoveredPercent(recovered, total)
  const label = `${recovered} of ${total} ${total === 1 ? 'clip' : 'clips'} recovered (${percent})`

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn('relative grid shrink-0 place-items-center', className)}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-muted" />
        {/* Hidden at 0%: a round cap would still draw a dot. */}
        {share > 0 && (
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - share * 100}
            className={cn(
              'transition-[stroke-dashoffset,stroke] duration-500',
              ringColor(share),
            )}
          />
        )}
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span className="font-semibold tabular-nums">{percent}</span>
        <span className="mt-[0.2em] text-[0.625em] text-muted-foreground">found</span>
      </div>
    </div>
  )
}
