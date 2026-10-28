import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '@convex/_generated/dataModel'
import { ClipFeed, GameFilter } from '@/features/feed'
import { useDocumentTitle } from '@/hooks/use-document-title'

type FeedSearch = {
  /** Opens that clip in the viewer, so a clip can be linked to directly. */
  clip?: Id<'clips'>
  /** Only shows clips of this game. */
  game?: string
}

export const Route = createFileRoute('/feed')({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    ...(typeof search.clip === 'string' && { clip: search.clip as Id<'clips'> }),
    ...(typeof search.game === 'string' && { game: search.game }),
  }),
  component: FeedPage,
})

function FeedPage() {
  const { clip, game } = Route.useSearch()
  const navigate = Route.useNavigate()
  useDocumentTitle('Recovered clips')

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recovered clips</h1>
        <p className="text-sm text-muted-foreground">
          Every clip found so far, newest upload first.
        </p>
      </div>
      <GameFilter
        gameId={game}
        onGameChange={(gameId) => navigate({ search: { game: gameId } })}
      />
      <ClipFeed
        gameId={game}
        openClipId={clip}
        onOpenClipChange={(clipId) =>
          navigate({ search: (prev) => ({ ...prev, clip: clipId }), resetScroll: false })
        }
      />
    </section>
  )
}
