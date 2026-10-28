import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { RecoveredRing } from '@/features/clips'
import { useRecentProfiles, type RecentProfile } from '../hooks/use-recent-profiles'
import { formatTimeAgo } from '../lib/format'

const CLOCK_TICK_MS = 60_000

/** The current time, refreshed every minute so "5 minutes ago" labels stay right. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(interval)
  }, [])
  return now
}

export function RecentProfiles() {
  const profiles = useRecentProfiles()
  const now = useNow()
  if (profiles?.length === 0) return null

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <h2 className="text-sm font-medium text-muted-foreground">Recently recovered</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {profiles
          ? profiles.map((profile) => (
              <li key={profile._id}>
                <RecentProfileLink profile={profile} now={now} />
              </li>
            ))
          : Array.from({ length: 4 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-19.5 rounded-lg" />
              </li>
            ))}
      </ul>
    </section>
  )
}

function RecentProfileLink({ profile, now }: { profile: RecentProfile; now: number }) {
  const details = [
    profile.clipCount !== null
      ? `${profile.clipCount} ${profile.clipCount === 1 ? 'clip' : 'clips'}`
      : null,
    formatTimeAgo(profile.retrievedAt, now),
  ].filter(Boolean)

  return (
    <Link
      to="/u/$username"
      params={{ username: profile.usernameKey }}
      className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted"
    >
      <Avatar>
        {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
        <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{profile.username}</span>
        <span className="text-xs text-muted-foreground">{details.join(' · ')}</span>
      </div>
      {profile.clipCount && profile.recoveredCount !== null ? (
        <RecoveredRing
          recovered={profile.recoveredCount}
          total={profile.clipCount}
          className="size-14 text-sm"
        />
      ) : null}
    </Link>
  )
}
