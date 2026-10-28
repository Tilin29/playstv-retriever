import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { FeedSort } from '../hooks/use-feed'
import { FEED_SORT_LABELS, isFeedSort } from '../lib/sort'

/** `searching`: title search results come by relevance, so the order can't be chosen. */
export function FeedSortSelect({
  sort,
  searching,
  onSortChange,
}: {
  sort: FeedSort
  searching: boolean
  onSortChange: (sort: FeedSort) => void
}) {
  if (searching) {
    return <p className="text-sm text-muted-foreground">Sorted by best match</p>
  }
  return (
    <NativeSelect
      aria-label="Sort clips"
      value={sort}
      onChange={(event) => {
        if (isFeedSort(event.target.value)) onSortChange(event.target.value)
      }}
    >
      {Object.entries(FEED_SORT_LABELS).map(([value, label]) => (
        <NativeSelectOption key={value} value={value}>
          {label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
