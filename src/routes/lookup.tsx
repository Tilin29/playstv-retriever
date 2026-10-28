import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '@convex/_generated/dataModel'
import { ClipLinkResults, ClipLinksButton, isLinkKey, MAX_CLIP_LINKS } from '@/features/clip-links'
import { useDocumentTitle } from '@/hooks/use-document-title'

type LookupSearch = {
  /**
   * The pasted links, comma-separated, in the order they were pasted: a clip's page id,
   * or `s:<code>` for a share link.
   */
  ids?: string
  /** Opens that clip in the viewer. */
  clip?: Id<'clips'>
}

export const Route = createFileRoute('/lookup')({
  validateSearch: (search: Record<string, unknown>): LookupSearch => ({
    ...(typeof search.ids === 'string' && { ids: search.ids }),
    ...(typeof search.clip === 'string' && { clip: search.clip as Id<'clips'> }),
  }),
  component: LookupPage,
})

function LookupPage() {
  const { ids = '', clip } = Route.useSearch()
  const navigate = Route.useNavigate()
  useDocumentTitle('Clip links')
  const linkKeys = ids.split(',').filter(isLinkKey).slice(0, MAX_CLIP_LINKS)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clip links</h1>
          <p className="text-sm text-muted-foreground">
            Clips found from their links are added to their owner's profile.
          </p>
        </div>
        <ClipLinksButton />
      </div>
      {linkKeys.length > 0 ? (
        <ClipLinkResults
          linkKeys={linkKeys}
          openClipId={clip}
          onOpenClipChange={(clipId) =>
            navigate({
              search: (prev) => ({ ...prev, clip: clipId }),
              resetScroll: false,
              // Stepping between clips replaces the entry, so Back closes the viewer.
              replace: clip !== undefined && clipId !== undefined,
            })
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">Paste some clip links to look them up.</p>
      )}
    </section>
  )
}
