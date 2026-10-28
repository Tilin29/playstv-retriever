import { FilmIcon } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { Id } from '@convex/_generated/dataModel'
import type { Clip } from '../hooks/use-clips'
import { isUnrecoverable, isWatchable } from '../lib/status'
import { ClipCard } from './clip-card'
import { ClipViewer } from './clip-viewer'

const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function ClipGrid({
  clips,
  openClipId,
  onOpenClipChange,
}: {
  clips: Clip[] | undefined
  /** The clip shown in the viewer, if any. */
  openClipId: Id<'clips'> | undefined
  onOpenClipChange: (clipId: Id<'clips'> | undefined) => void
}) {
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
  const openClip = clips.find((clip) => clip._id === openClipId && isWatchable(clip)) ?? null
  const onOpen = (clip: Clip) => onOpenClipChange(clip._id)

  return (
    <div className="flex flex-col gap-8">
      <ClipSection title="Recoverable" clips={recoverable} onOpen={onOpen} />
      <ClipSection title="Couldn't be recovered" clips={unrecoverable} onOpen={onOpen} />
      <ClipViewer clip={openClip} onClose={() => onOpenClipChange(undefined)} />
    </div>
  )
}

function ClipSection({
  title,
  clips,
  onOpen,
}: {
  title: string
  clips: Clip[]
  onOpen: (clip: Clip) => void
}) {
  if (clips.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({clips.length})</span>
      </h2>
      <div className={GRID_CLASSES}>
        {clips.map((clip) => (
          <ClipCard key={clip._id} clip={clip} onOpen={() => onOpen(clip)} />
        ))}
      </div>
    </section>
  )
}
