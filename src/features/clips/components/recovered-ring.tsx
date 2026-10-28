import { cn } from '@/lib/utils'
import { formatRecoveredPercent } from '../lib/format'

/**
 * A ring that fills up with the share of clips whose full video was recovered,
 * with the percentage in the middle.
 */
export function RecoveredRing({
  recovered,
  total,
  showCaption = false,
  className,
}: {
  recovered: number
  total: number
  /** Adds "recovered" under the percentage; only fits on larger rings. */
  showCaption?: boolean
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
            className="stroke-primary transition-[stroke-dashoffset] duration-500"
          />
        )}
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span className="font-semibold tabular-nums">{percent}</span>
        {showCaption && (
          <span className="mt-0.5 text-[0.625rem] text-muted-foreground">recovered</span>
        )}
      </div>
    </div>
  )
}
