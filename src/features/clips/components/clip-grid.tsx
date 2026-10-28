import { FilmIcon } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { Clip } from '../hooks/use-clips'
import { isUnrecoverable } from '../lib/status'
import { ClipCard } from './clip-card'

const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function ClipGrid({ clips }: { clips: Clip[] | undefined }) {
  if (clips === undefined) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-video" />
        ))}
      </div>
    )
  }

  if (clips.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilmIcon />
          </EmptyMedia>
          <EmptyTitle>No clips on the archived page</EmptyTitle>
          <EmptyDescription>
            The profile was saved, but its clip list wasn't captured.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // Clips still being checked stay with the recoverable ones until the archive answers.
  const recoverable = clips.filter((clip) => !isUnrecoverable(clip))
  const unrecoverable = clips.filter(isUnrecoverable)

  return (
    <div className="flex flex-col gap-8">
      <ClipSection title="Recoverable" clips={recoverable} />
      <ClipSection title="Couldn't be recovered" clips={unrecoverable} />
    </div>
  )
}

function ClipSection({ title, clips }: { title: string; clips: Clip[] }) {
  if (clips.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({clips.length})</span>
      </h2>
      <div className={GRID_CLASSES}>
        {clips.map((clip) => (
          <ClipCard key={clip._id} clip={clip} />
        ))}
      </div>
    </section>
  )
}
