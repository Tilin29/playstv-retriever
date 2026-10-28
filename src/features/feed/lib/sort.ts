import type { FeedSort } from '../hooks/use-feed'

/**
 * "Uploaded" is when the clip was published on Plays.tv (2014–2019); "recovered" is when
 * this website found it in the archive.
 */
export const FEED_SORT_LABELS: Record<FeedSort, string> = {
  uploaded_desc: 'Uploaded to Plays.tv: newest first',
  uploaded_asc: 'Uploaded to Plays.tv: oldest first',
  added_desc: 'Recovered here: most recent first',
  added_asc: 'Recovered here: earliest first',
}

export function isFeedSort(value: unknown): value is FeedSort {
  return typeof value === 'string' && value in FEED_SORT_LABELS
}
