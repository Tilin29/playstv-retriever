import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '@convex/_generated/dataModel'
import {
  ClipFeed,
  DEFAULT_FEED_SORT,
  FeedSortSelect,
  GameFilter,
  isFeedSort,
  type FeedSort,
} from '@/features/feed'
import { useDocumentTitle } from '@/hooks/use-document-title'

type FeedSearch = {
  /** Opens that clip in the viewer, so a clip can be linked to directly. */
  clip?: Id<'clips'>
  /** Only shows clips of this game. */
  game?: string
  /** Left out for the default order. */
  sort?: FeedSort
}

export const Route = createFileRoute('/feed')({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    ...(typeof search.clip === 'string' && { clip: search.clip as Id<'clips'> }),
    ...(typeof search.game === 'string' && { game: search.game }),
    ...(isFeedSort(search.sort) && search.sort !== DEFAULT_FEED_SORT && { sort: search.sort }),
  }),
  component: FeedPage,
})

function FeedPage() {
  const { clip, game, sort = DEFAULT_FEED_SORT } = Route.useSearch()
  const navigate = Route.useNavigate()
  useDocumentTitle('Recovered clips')

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Recovered clips</h1>
          <p className="text-sm text-muted-foreground">Every clip found so far.</p>
        </div>
        <FeedSortSelect
          sort={sort}
          onSortChange={(newSort) =>
            navigate({
              search: (prev) => ({
                game: prev.game,
                sort: newSort === DEFAULT_FEED_SORT ? undefined : newSort,
              }),
            })
          }
        />
      </div>
      <GameFilter
        gameId={game}
        onGameChange={(gameId) =>
          navigate({ search: (prev) => ({ game: gameId, sort: prev.sort }) })
        }
      />
      <ClipFeed
        gameId={game}
        sort={sort}
        openClipId={clip}
        onOpenClipChange={(clipId) =>
          navigate({
            search: (prev) => ({ ...prev, clip: clipId }),
            resetScroll: false,
            // Stepping between clips replaces the entry, so Back closes the viewer.
            replace: clip !== undefined && clipId !== undefined,
          })
        }
      />
    </section>
  )
}
