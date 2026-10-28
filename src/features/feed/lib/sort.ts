import type { FeedSort } from '../hooks/use-feed'

/** "Upload" is when the clip was published on Plays.tv; "added" is when it was saved here. */
export const FEED_SORT_LABELS: Record<FeedSort, string> = {
  uploaded_desc: 'Newest upload',
  uploaded_asc: 'Oldest upload',
  added_desc: 'Recently added',
  added_asc: 'First added',
}

export function isFeedSort(value: unknown): value is FeedSort {
  return typeof value === 'string' && value in FEED_SORT_LABELS
}
