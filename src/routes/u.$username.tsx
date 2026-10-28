import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '@convex/_generated/dataModel'
import { ProfileView } from '@/features/profile'
import { UsernameSearchForm } from '@/features/user-search'

export const Route = createFileRoute('/u/$username')({
  // `clip` opens that clip in the viewer, so a clip can be linked to directly.
  validateSearch: (search: Record<string, unknown>): { clip?: Id<'clips'> } =>
    typeof search.clip === 'string' ? { clip: search.clip as Id<'clips'> } : {},
  component: UserPage,
})

function UserPage() {
  const { username } = Route.useParams()
  const { clip } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <section className="flex flex-col gap-8">
      <div className="mx-auto w-full max-w-xl">
        <UsernameSearchForm key={username} defaultValue={username} />
      </div>
      <ProfileView
        key={username}
        username={username}
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
    </section>
  )
}
