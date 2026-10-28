import { usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'
import { dayEnd, dayStart } from '../lib/dates'

export type FeedClip = FunctionReturnType<typeof api.clips.listFeed>['page'][number]
export type FeedGame = FunctionReturnType<typeof api.games.search>[number]
export type FeedUser = FunctionReturnType<typeof api.profiles.searchFeedUsers>[number]
export type FeedSort = NonNullable<FunctionArgs<typeof api.clips.listFeed>['sort']>

export const FEED_PAGE_SIZE = 24
export const DEFAULT_FEED_SORT: FeedSort = 'uploaded_desc'

/** The feed's filters, as they appear in the URL. Dates are YYYY-MM-DD. */
export type FeedFilters = {
  /** Words in the title. */
  q?: string
  /** The uploader's username key. */
  user?: string
  game?: string
  from?: string
  to?: string
}

/** Recovered clips matching `filters`, in `sort` order (by relevance while searching titles). */
export function useFeed(filters: FeedFilters, sort: FeedSort) {
  return usePaginatedQuery(
    api.clips.listFeed,
    {
      search: filters.q,
      username: filters.user,
      gameId: filters.game,
      from: filters.from ? dayStart(filters.from) : undefined,
      to: filters.to ? dayEnd(filters.to) : undefined,
      sort,
    },
    { initialNumItems: FEED_PAGE_SIZE },
  )
}

/** Games with recovered clips matching `text`; the most recovered when it's empty. */
export function useGameSearch(text: string) {
  return useQuery(api.games.search, { text })
}

export function useGame(gameId: string | undefined) {
  return useQuery(api.games.get, gameId ? { gameId } : 'skip')
}

/** Uploaders with recovered clips whose username starts with `prefix`. */
export function useUserSearch(prefix: string) {
  return useQuery(api.profiles.searchFeedUsers, { prefix })
}

/** The uploader the feed is filtered by, for showing their display name. */
export function useFeedUser(usernameKey: string | undefined) {
  return useQuery(api.profiles.get, usernameKey ? { username: usernameKey } : 'skip')
}
