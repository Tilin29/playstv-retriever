import { createFileRoute } from '@tanstack/react-router'
import { RecentProfiles } from '@/features/recent-profiles'
import { UsernameSearchForm } from '@/features/user-search'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 pt-16 text-center sm:pt-24">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Find your lost Plays.tv clips
        </h1>
        <p className="text-balance text-muted-foreground">
          Plays.tv shut down in 2019 and took its clips with it. Many were saved by the Wayback
          Machine. Search a username to see what can still be recovered.
        </p>
      </div>
      <UsernameSearchForm autoFocus />
      <p className="text-sm text-muted-foreground">
        Not affiliated with Plays.tv or the Internet Archive.
      </p>
      <RecentProfiles />
    </section>
  )
}
