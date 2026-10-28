import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type FeedClip = FunctionReturnType<typeof api.clips.listFeed>['page'][number]
export type FeedGame = FunctionReturnType<typeof api.games.list>[number]
export type FeedSort = NonNullable<FunctionArgs<typeof api.clips.listFeed>['sort']>

export const FEED_PAGE_SIZE = 24
export const DEFAULT_FEED_SORT: FeedSort = 'uploaded_desc'

/** Recovered clips in `sort` order, of one game when `gameId` is set. */
export function useFeed(gameId: string | undefined, sort: FeedSort) {
  return usePaginatedQuery(
    api.clips.listFeed,
    { gameId, sort },
    { initialNumItems: FEED_PAGE_SIZE },
  )
}

export function useFeedGames() {
  return useQuery(api.games.list, {})
}
