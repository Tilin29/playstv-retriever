import { useEffect, useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { FeedFilters as Filters } from '../hooks/use-feed'
import { isDateParam } from '../lib/dates'
import { GameFilter } from './game-filter'
import { UserFilter } from './user-filter'

// How long typing pauses before the title search runs.
const SEARCH_DELAY_MS = 300

/** Title search, uploader, game and upload-date filters for the feed. */
export function FeedFilters({
  filters,
  onFiltersChange,
}: {
  filters: Filters
  /** `debounced` marks changes made while typing, which shouldn't each add history. */
  onFiltersChange: (changes: Partial<Filters>, options?: { debounced?: boolean }) => void
}) {
  const active = Object.values(filters).some((value) => value !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <TitleSearch
        value={filters.q}
        onChange={(q) => onFiltersChange({ q }, { debounced: true })}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel>User</FieldLabel>
          <UserFilter
            usernameKey={filters.user}
            onUserChange={(user) => onFiltersChange({ user })}
          />
        </Field>
        <Field>
          <FieldLabel>Game</FieldLabel>
          <GameFilter gameId={filters.game} onGameChange={(game) => onFiltersChange({ game })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="feed-from">Uploaded from</FieldLabel>
          <DateFilter
            id="feed-from"
            value={filters.from}
            max={filters.to}
            onChange={(from) => onFiltersChange({ from })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="feed-to">Uploaded to</FieldLabel>
          <DateFilter
            id="feed-to"
            value={filters.to}
            min={filters.from}
            onChange={(to) => onFiltersChange({ to })}
          />
        </Field>
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            onFiltersChange({
              q: undefined,
              user: undefined,
              game: undefined,
              from: undefined,
              to: undefined,
            })
          }
        >
          <XIcon />
          Clear filters
        </Button>
      )}
    </div>
  )
}

/**
 * A date input that only applies whole dates. While the year is being typed the browser
 * reports partial years like 0020, and sending those through the URL makes the input
 * reset mid-typing.
 */
function DateFilter({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [text, setText] = useState(value ?? '')
  // Take on outside changes (e.g. "Clear filters" or Back) without fighting the typing.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value ?? '')
  }

  return (
    <Input
      {...props}
      type="date"
      value={text}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (!next) {
          if (value !== undefined) onChange(undefined)
        } else if (isDateParam(next) && Number(next.slice(0, 4)) >= 1000 && next !== value) {
          onChange(next)
        }
      }}
    />
  )
}

/** Searches titles once typing pauses; follows the URL when the filters are cleared. */
function TitleSearch({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [text, setText] = useState(value ?? '')
  // Take on outside changes (e.g. "Clear filters" or Back) without fighting the typing.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if ((value ?? '') !== text.trim()) setText(value ?? '')
  }

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => {
    const next = text.trim() || undefined
    if (next === value) return
    const timeout = setTimeout(() => onChangeRef.current(next), SEARCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [text, value])

  return (
    <InputGroup className="h-10">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label="Search clip titles"
        placeholder="Search clip titles"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </InputGroup>
  )
}
