import { Link } from '@tanstack/react-router'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileActions, type HiddenProfile } from '../hooks/use-moderation'
import { formatDateTime } from '../lib/format'

export function HiddenProfiles({
  sessionToken,
  hidden,
}: {
  sessionToken: string
  hidden: HiddenProfile[] | undefined
}) {
  const { setHidden, pending, error } = useProfileActions(sessionToken)

  if (hidden === undefined) return <Skeleton className="h-48" />

  if (hidden.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <EyeOffIcon />
          </EmptyMedia>
          <EmptyTitle>No hidden profiles</EmptyTitle>
          <EmptyDescription>
            Hide a profile from its page. It and its clips then disappear for everyone else.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {hidden.map((profile) => {
        const busy = pending === profile._id
        return (
          <div
            key={profile._id}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
          >
            <Avatar>
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
              <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                to="/u/$username"
                params={{ username: profile.usernameKey }}
                className="truncate font-medium hover:underline"
              >
                {profile.username}
              </Link>
              <p className="text-sm text-muted-foreground">
                Hidden {formatDateTime(profile.hiddenAt)}
                {profile.clipCount !== null &&
                  ` · ${profile.clipCount} ${profile.clipCount === 1 ? 'clip' : 'clips'}`}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void setHidden(profile._id, false)}
            >
              <EyeIcon />
              {busy ? 'Unhiding…' : 'Unhide'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
