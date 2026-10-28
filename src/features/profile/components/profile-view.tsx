import { AlertCircleIcon, SearchXIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ClipGrid, useClips } from '@/features/clips'
import type { Id } from '@convex/_generated/dataModel'
import { useProfile, type Profile } from '../hooks/use-profile'
import { ProfileHeader } from './profile-header'

type ClipViewerProps = {
  openClipId: Id<'clips'> | undefined
  onOpenClipChange: (clipId: Id<'clips'> | undefined) => void
}

export function ProfileView({ username, ...viewerProps }: { username: string } & ClipViewerProps) {
  const { profile, lookupError, retry } = useProfile(username)
  useDocumentTitle(
    !profile || profile.status === 'searching'
      ? `Searching for ${username}…`
      : profile.status === 'ready'
        ? profile.username
        : username,
  )

  if (lookupError || profile?.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Couldn't search the Wayback Machine</AlertTitle>
        <AlertDescription>
          {lookupError ?? profile?.error ?? 'Something went wrong.'} The Internet Archive is
          sometimes slow or briefly offline, so trying again often helps.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (!profile || profile.status === 'searching') {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Searching the Wayback Machine…</EmptyTitle>
          <EmptyDescription>
            Looking for archived copies of plays.tv/u/{username}. This can take a little while.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (profile.status === 'not_found') {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No archived profile found</EmptyTitle>
          <EmptyDescription>
            The Wayback Machine has no saved copy of plays.tv/u/{username}. Check the spelling, or
            try another name you used.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <ReadyProfile profile={profile} {...viewerProps} />
}

function ReadyProfile({ profile, ...viewerProps }: { profile: Profile } & ClipViewerProps) {
  const clips = useClips(profile._id)
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={profile} clips={clips} />
      <ClipGrid
        clips={clips}
        owner={{
          username: profile.username,
          usernameKey: profile.usernameKey,
          avatarUrl: profile.avatarUrl,
        }}
        {...viewerProps}
      />
    </div>
  )
}
