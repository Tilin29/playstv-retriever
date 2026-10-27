import { ExternalLinkIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Clip } from '@/features/clips'
import type { Profile } from '../hooks/use-profile'
import { formatExpiry, formatSnapshotDate } from '../lib/format'

export function ProfileHeader({ profile, clips }: { profile: Profile; clips: Clip[] | undefined }) {
  const pending = clips?.filter((clip) => clip.mediaStatus === 'pending').length ?? 0
  const facts = [
    clips ? `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}` : null,
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {pending > 0 ? (
            <>
              <Spinner />
              Downloading previews… {clips!.length - pending} of {clips!.length}
            </>
          ) : (
            `Saved here until ${formatExpiry(profile.expiresAt)}`
          )}
        </p>
      </div>
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
  )
}
