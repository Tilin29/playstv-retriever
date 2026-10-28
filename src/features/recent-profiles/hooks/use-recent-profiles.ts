import { useState } from 'react'
import { usePaginatedQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type RecentProfile = FunctionReturnType<typeof api.profiles.listRecent>['page'][number]

export const RECENT_PROFILES_PAGE_SIZE = 8

/**
 * Recent profiles one page at a time. Pages already seen stay loaded, so going back
 * is instant; going forward loads the next page when needed.
 */
export function useRecentProfiles() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.profiles.listRecent,
    {},
    { initialNumItems: RECENT_PROFILES_PAGE_SIZE },
  )
  const [pageIndex, setPageIndex] = useState(0)

  const start = pageIndex * RECENT_PROFILES_PAGE_SIZE
  const end = start + RECENT_PROFILES_PAGE_SIZE
  const profiles = results.slice(start, end)
  const loading = status === 'LoadingFirstPage' || (status === 'LoadingMore' && profiles.length === 0)

  const hasNext = results.length > end || status === 'CanLoadMore'
  return {
    /** Undefined while the current page is loading. */
    profiles: loading ? undefined : profiles,
    isEmpty: status === 'Exhausted' && results.length === 0,
    hasPages: hasNext || pageIndex > 0,
    hasPrevious: pageIndex > 0,
    hasNext,
    goToPrevious: () => setPageIndex((index) => Math.max(index - 1, 0)),
    goToNext: () => {
      if (!hasNext) return
      if (results.length < end + RECENT_PROFILES_PAGE_SIZE && status === 'CanLoadMore') {
        loadMore(RECENT_PROFILES_PAGE_SIZE)
      }
      setPageIndex(pageIndex + 1)
    },
  }
}
