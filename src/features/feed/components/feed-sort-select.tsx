import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { FeedSort } from '../hooks/use-feed'
import { FEED_SORT_LABELS, isFeedSort } from '../lib/sort'

export function FeedSortSelect({
  sort,
  onSortChange,
}: {
  sort: FeedSort
  onSortChange: (sort: FeedSort) => void
}) {
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
