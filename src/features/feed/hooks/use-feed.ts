import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type FeedClip = FunctionReturnType<typeof api.clips.listFeed>['page'][number]
export type FeedGame = FunctionReturnType<typeof api.games.list>[number]

export const FEED_PAGE_SIZE = 24

/** Recovered clips, of one game when `gameId` is set. */
export function useFeed(gameId: string | undefined) {
  return usePaginatedQuery(api.clips.listFeed, { gameId }, { initialNumItems: FEED_PAGE_SIZE })
}

export function useFeedGames() {
  return useQuery(api.games.list, {})
}
