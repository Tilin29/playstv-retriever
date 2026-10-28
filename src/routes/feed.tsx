import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '@convex/_generated/dataModel'
import {
  ClipFeed,
  DEFAULT_FEED_SORT,
  FeedFilters,
  FeedSortSelect,
  isDateParam,
  isFeedSort,
  type FeedFilterValues,
  type FeedSort,
} from '@/features/feed'
import { useDocumentTitle } from '@/hooks/use-document-title'

type FeedSearch = FeedFilterValues & {
  /** Opens that clip in the viewer, so a clip can be linked to directly. */
  clip?: Id<'clips'>
  /** Left out for the default order. */
  sort?: FeedSort
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)

export const Route = createFileRoute('/feed')({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    ...(typeof search.clip === 'string' && { clip: search.clip as Id<'clips'> }),
    ...(text(search.q) && { q: text(search.q) }),
    ...(text(search.user) && { user: text(search.user) }),
    ...(text(search.game) && { game: text(search.game) }),
    ...(isDateParam(search.from) && { from: search.from }),
    ...(isDateParam(search.to) && { to: search.to }),
    ...(isFeedSort(search.sort) && search.sort !== DEFAULT_FEED_SORT && { sort: search.sort }),
  }),
  component: FeedPage,
})

function FeedPage() {
  const { clip, sort = DEFAULT_FEED_SORT, ...filters } = Route.useSearch()
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
          searching={filters.q !== undefined}
          onSortChange={(newSort) =>
            navigate({
              search: (prev) => ({
                ...prev,
                clip: undefined,
                sort: newSort === DEFAULT_FEED_SORT ? undefined : newSort,
              }),
            })
          }
        />
      </div>
      <FeedFilters
        filters={filters}
        onFiltersChange={(changes, options) =>
          navigate({
            search: (prev) => ({ ...prev, ...changes, clip: undefined }),
            // Refining a search already under way replaces its entry, so each pause while
            // typing doesn't become its own Back step.
            replace: options?.debounced && filters.q !== undefined,
          })
        }
      />
      <ClipFeed
        filters={filters}
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
