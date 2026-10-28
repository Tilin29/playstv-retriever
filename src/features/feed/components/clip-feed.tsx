import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { FilmIcon } from 'lucide-react'
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
import { ClipCard, ClipViewer } from '@/features/clips'
import type { Id } from '@convex/_generated/dataModel'
import { FEED_PAGE_SIZE, useFeed, type FeedClip } from '../hooks/use-feed'

const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function ClipFeed({
  gameId,
  openClipId,
  onOpenClipChange,
}: {
  /** Only clips of this game, if set. */
  gameId: string | undefined
  /** The clip shown in the viewer, if any. */
  openClipId: Id<'clips'> | undefined
  onOpenClipChange: (clipId: Id<'clips'> | undefined) => void
}) {
  const { results, status, loadMore } = useFeed(gameId)
  const loadMoreRef = useLoadMoreOnScroll(
    status === 'CanLoadMore' ? () => loadMore(FEED_PAGE_SIZE) : null,
  )

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
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilmIcon />
          </EmptyMedia>
          <EmptyTitle>No recovered clips yet</EmptyTitle>
          <EmptyDescription>
            Search a username and the clips that can be recovered will show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const openClip = results.find((clip) => clip._id === openClipId) ?? null

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
      <ClipViewer clip={openClip} onClose={() => onOpenClipChange(undefined)} />
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
