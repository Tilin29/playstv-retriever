import { Link } from '@tanstack/react-router'
import { AlertCircleIcon, SearchXIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ClipCard, ClipViewer, isWatchable } from '@/features/clips'
import type { Id } from '@convex/_generated/dataModel'
import { useClipLinks, type ClipLinkResult, type FoundClip } from '../hooks/use-clip-links'
import { linkKeyLabel } from '../lib/parse-links'

const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

const MISSING_NOTES: Record<Exclude<ClipLinkResult['status'], 'found'>, string> = {
  searching: 'Searching the Wayback Machine…',
  not_found: 'Not saved by the Wayback Machine',
  error: "The archive didn't respond. Look it up again later.",
}

export function ClipLinkResults({
  linkKeys,
  openClipId,
  onOpenClipChange,
}: {
  /** The pasted links, as parseClipLinks keys them. */
  linkKeys: string[]
  /** The clip shown in the viewer, if any. */
  openClipId: Id<'clips'> | undefined
  onOpenClipChange: (clipId: Id<'clips'> | undefined) => void
}) {
  const { results, error } = useClipLinks(linkKeys)

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (results === undefined) {
    return (
      <div className={GRID_CLASSES}>
        {linkKeys.slice(0, 6).map((key) => (
          <Skeleton key={key} className="aspect-video" />
        ))}
      </div>
    )
  }

  const found = results.flatMap((result) => (result.clip ? [result.clip] : []))
  const missing = results.filter(
    (result): result is ClipLinkResult & { status: keyof typeof MISSING_NOTES } =>
      result.status !== 'found',
  )
  const searching = missing.filter((result) => result.status === 'searching').length

  // The viewer steps through the watchable clips in the order they're shown.
  const watchable = found.filter(isWatchable)
  const openIndex = watchable.findIndex((clip) => clip._id === openClipId)
  const openClip = watchable[openIndex] ?? null
  const previous = openIndex > 0 ? watchable[openIndex - 1] : null
  const next = openIndex >= 0 ? (watchable[openIndex + 1] ?? null) : null

  return (
    <div className="flex flex-col gap-8">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {searching > 0 && <Spinner />}
        {found.length} of {results.length} found
        {searching > 0 && ` · still searching for ${searching}`}
      </p>

      {found.length > 0 ? (
        <ul className={GRID_CLASSES}>
          {found.map((clip) => (
            <li key={clip._id}>
              <FoundClipItem clip={clip} onOpen={() => onOpenClipChange(clip._id)} />
            </li>
          ))}
        </ul>
      ) : (
        searching === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>None of these clips were found</EmptyTitle>
              <EmptyDescription>
                The Wayback Machine has no saved copy of their pages.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      )}

      {missing.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Not found yet <span className="tabular-nums">({missing.length})</span>
          </h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {missing.map((result) => (
              <li
                key={result.key}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2"
              >
                <span className="font-mono text-xs break-all">{linkKeyLabel(result.key)}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {result.status === 'searching' && <Spinner />}
                  {MISSING_NOTES[result.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ClipViewer
        clip={openClip}
        owner={openClip?.owner ?? null}
        onClose={() => onOpenClipChange(undefined)}
        onPrevious={previous && (() => onOpenClipChange(previous._id))}
        onNext={next && (() => onOpenClipChange(next._id))}
      />
    </div>
  )
}

function FoundClipItem({ clip, onOpen }: { clip: FoundClip; onOpen: () => void }) {
  const { owner } = clip
  return (
    <div className="flex flex-col gap-2">
      <ClipCard clip={clip} justLost={false} onOpen={onOpen} />
      <Link
        to="/u/$username"
        params={{ username: owner.usernameKey }}
        className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
      >
        <Avatar size="sm">
          {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
          <AvatarFallback>{owner.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {owner.username}
      </Link>
    </div>
  )
}
