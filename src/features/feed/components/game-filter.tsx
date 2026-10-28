import { useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { useGame, useGameSearch } from '../hooks/use-feed'

type GameOption = { gameId: string; name: string; recoveredCount?: number }

/**
 * Picks one game to show clips of. There are too many games to list, so it searches
 * them by name; before anything is typed it offers the games with the most clips.
 */
export function GameFilter({
  gameId,
  onGameChange,
}: {
  gameId: string | undefined
  onGameChange: (gameId: string | undefined) => void
}) {
  const [query, setQuery] = useState('')
  const games = useGameSearch(query)
  const selected = useGame(gameId)
  const value: GameOption | null = gameId ? (selected ?? { gameId, name: 'Loading…' }) : null

  return (
    <Combobox
      items={games ?? []}
      value={value}
      onValueChange={(game: GameOption | null) => onGameChange(game?.gameId)}
      onInputValueChange={setQuery}
      itemToStringLabel={(game: GameOption) => game.name}
      isItemEqualToValue={(a: GameOption, b: GameOption) => a.gameId === b.gameId}
      // The server already matched the games to what was typed.
      filter={null}
    >
      <ComboboxInput placeholder="Any game" aria-label="Game" showClear className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{games === undefined ? 'Searching…' : 'No games found.'}</ComboboxEmpty>
        <ComboboxList>
          {(game: GameOption) => (
            <ComboboxItem key={game.gameId} value={game}>
              <span className="min-w-0 flex-1 truncate">{game.name}</span>
              {game.recoveredCount !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {game.recoveredCount}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
