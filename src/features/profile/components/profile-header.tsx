import { ExternalLinkIcon, RotateCwIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { isWatchable, RecoveredRing, type Clip } from '@/features/clips'
import type { Profile } from '../hooks/use-profile'
import { useRetryMissingVideos } from '../hooks/use-retry-missing-videos'
import { formatExpiry, formatSnapshotDate } from '../lib/format'

export function ProfileHeader({ profile, clips }: { profile: Profile; clips: Clip[] | undefined }) {
  const total = clips?.length ?? 0
  const savingPreviews = clips?.filter((clip) => clip.mediaStatus === 'pending').length ?? 0
  const checkingVideos =
    clips?.filter((clip) => clip.videoStatus === 'checking' || clip.videoStatus === 'rechecking')
      .length ?? 0
  const progress =
    [
      savingPreviews > 0 ? `Saving previews… ${total - savingPreviews} of ${total}` : null,
      checkingVideos > 0 ? `Checking for full videos… ${total - checkingVideos} of ${total}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  const recovered = clips?.filter(isWatchable).length ?? 0
  const facts = [
    clips ? `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}` : null,
    total > 0 ? `${recovered} recovered` : null,
    profile.snapshotTimestamp ? `Archived ${formatSnapshotDate(profile.snapshotTimestamp)}` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar className="size-16">
        {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
        <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.username}</h1>
        <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>
        {profile.clipListIncomplete && (
          <p className="text-sm text-muted-foreground">
            The Wayback Machine stopped responding while listing older clips, so some may be
            missing.
          </p>
        )}
        {progress ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {progress}
          </p>
        ) : (
          profile.mediaExpiresAt !== null && (
            <p className="text-sm text-muted-foreground">
              Previews saved here until {formatExpiry(profile.mediaExpiresAt)}
            </p>
          )
        )}
      </div>
      {total > 0 && (
        <RecoveredRing recovered={recovered} total={total} className="size-20 text-base" />
      )}
      <div className="flex flex-wrap gap-2">
        {/* Only once every clip was checked, so it can't pile onto a running search. */}
        {clips && checkingVideos === 0 && recovered < total && (
          <RetryMissingVideosButton profileId={profile._id} />
        )}
        {profile.snapshotViewUrl && (
          <a
            href={profile.snapshotViewUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            View archived page
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        )}
      </div>
    </div>
  )
}

function RetryMissingVideosButton({ profileId }: { profileId: Profile['_id'] }) {
  const { retry, pending, error } = useRetryMissingVideos(profileId)
  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" disabled={pending} onClick={() => void retry()}>
        {pending ? <Spinner data-icon="inline-start" /> : <RotateCwIcon data-icon="inline-start" />}
        Search again
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
