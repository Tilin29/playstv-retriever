import { Button } from '@/components/ui/button'
import { useFeedGames } from '../hooks/use-feed'

/** One chip per game with recovered clips; scrolls sideways when there are many. */
export function GameFilter({
  gameId,
  onGameChange,
}: {
  gameId: string | undefined
  onGameChange: (gameId: string | undefined) => void
}) {
  const games = useFeedGames()
  if (!games || games.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Filter by game"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      <Chip selected={gameId === undefined} onClick={() => onGameChange(undefined)}>
        All games
      </Chip>
      {games.map((game) => (
        <Chip
          key={game.gameId}
          selected={game.gameId === gameId}
          onClick={() => onGameChange(game.gameId)}
        >
          {game.name}
          <span className="tabular-nums opacity-60">{game.recoveredCount}</span>
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      size="sm"
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-full"
    >
      {children}
    </Button>
  )
}
