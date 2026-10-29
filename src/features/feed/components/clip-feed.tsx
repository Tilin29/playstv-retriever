import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FilmIcon, SearchXIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ClipCard, ClipViewer, clipSteps, useShuffle } from '@/features/clips'
import type { Id } from '@convex/_generated/dataModel'
import {
  FEED_PAGE_SIZE,
  useFeed,
  useRandomFeedClip,
  type FeedClip,
  type FeedFilters,
  type FeedSort,
} from '../hooks/use-feed'

const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
const VIEWER_PRELOAD_CLIPS = 3

export function ClipFeed({
  filters,
  sort,
  openClipId,
  onOpenClipChange,
}: {
  filters: FeedFilters
  sort: FeedSort
  /** The clip shown in the viewer, if any. */
  openClipId: Id<'clips'> | undefined
  onOpenClipChange: (clipId: Id<'clips'> | undefined) => void
}) {
  const { results, status, loadMore } = useFeed(filters, sort)
  const loadMoreRef = useLoadMoreOnScroll(
    status === 'CanLoadMore' ? () => loadMore(FEED_PAGE_SIZE) : null,
  )

  // Shuffled, the server picks from the whole (filtered) feed, not only the loaded pages.
  const shuffle = useShuffle(openClipId)
  const randomNext = useRandomFeedClip(
    filters,
    shuffle.shuffle && openClipId ? { seed: shuffle.stepSeed, exclude: shuffle.history } : null,
  )
  // Picks beyond the loaded pages are kept, so they can be shown and stepped back to.
  const [picked, setPicked] = useState<FeedClip[]>([])
  if (randomNext && !picked.some((clip) => clip._id === randomNext._id)) {
    setPicked([...picked, randomNext])
  } else if (!openClipId && picked.length > 0) {
    setPicked([])
  }
  const { openClip, previous, next } = clipSteps(results, openClipId, shuffle, {
    randomNext: randomNext ?? null,
    extraClips: picked,
  })

  const openIndex = results.findIndex((clip) => clip._id === openClipId)
  // Stepping through clips in the viewer loads the next page before it runs out.
  const nearEnd =
    !shuffle.shuffle && openIndex >= 0 && openIndex >= results.length - VIEWER_PRELOAD_CLIPS
  useEffect(() => {
    if (nearEnd && status === 'CanLoadMore') loadMore(FEED_PAGE_SIZE)
  }, [nearEnd, status, loadMore])

  if (status === 'LoadingFirstPage') {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-video" />
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    const filtered = Object.values(filters).some((value) => value !== undefined)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {filtered ? <SearchXIcon /> : <FilmIcon />}
          </EmptyMedia>
          <EmptyTitle>{filtered ? 'No clips match these filters' : 'No recovered clips yet'}</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? 'Try other words, another user or game, or a wider date range.'
              : 'Search a username and the clips that can be recovered will show up here.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className={GRID_CLASSES}>
        {results.map((clip) => (
          <li key={clip._id}>
            <FeedItem clip={clip} onOpen={() => onOpenClipChange(clip._id)} />
          </li>
        ))}
      </ul>
      <div ref={loadMoreRef} className="flex justify-center">
        {status === 'LoadingMore' && <Spinner />}
        {/* Also a button, for when scrolling doesn't trigger it (e.g. keyboard users). */}
        {status === 'CanLoadMore' && (
          <Button variant="outline" onClick={() => loadMore(FEED_PAGE_SIZE)}>
            Load more
          </Button>
        )}
      </div>
      <ClipViewer
        clip={openClip}
        owner={openClip?.owner ?? null}
        onClose={() => onOpenClipChange(undefined)}
        onPrevious={previous && (() => onOpenClipChange(previous._id))}
        onNext={next && (() => onOpenClipChange(next._id))}
        shuffle={shuffle.shuffle}
        onShuffleChange={shuffle.setShuffle}
      />
    </div>
  )
}

function FeedItem({ clip, onOpen }: { clip: FeedClip; onOpen: () => void }) {
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

/** Calls `onLoadMore` when the returned element scrolls near the viewport. */
function useLoadMoreOnScroll(onLoadMore: (() => void) | null) {
  const ref = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  })

  const canLoadMore = onLoadMore !== null
  useEffect(() => {
    const element = ref.current
    if (!element || !canLoadMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMoreRef.current?.()
      },
      { rootMargin: '400px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [canLoadMore])

  return ref
}
