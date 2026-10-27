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

  return (
    <div className={GRID_CLASSES}>
      {clips.map((clip) => (
        <ClipCard key={clip._id} clip={clip} />
      ))}
    </div>
  )
}
