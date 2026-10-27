import { createFileRoute } from '@tanstack/react-router'
import { ProfileView } from '@/features/profile'
import { UsernameSearchForm } from '@/features/user-search'

export const Route = createFileRoute('/u/$username')({
  component: UserPage,
})

function UserPage() {
  const { username } = Route.useParams()

  return (
    <section className="flex flex-col gap-8">
      <div className="mx-auto w-full max-w-xl">
        <UsernameSearchForm key={username} defaultValue={username} />
      </div>
      <ProfileView key={username} username={username} />
    </section>
  )
}
