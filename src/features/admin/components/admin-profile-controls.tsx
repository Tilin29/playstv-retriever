import { useState } from 'react'
import { EyeIcon, EyeOffIcon, ShieldIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Id } from '@convex/_generated/dataModel'
import { useAdminSession } from '../hooks/use-admin-session'
import { useProfileActions } from '../hooks/use-moderation'

/**
 * Hides a whole profile from everyone else, or shows it again, for a signed-in admin on
 * the profile's page. Hiding asks for confirmation. Every action is checked server-side.
 */
export function AdminProfileControls({
  profileId,
  hidden,
}: {
  profileId: Id<'profiles'>
  hidden: boolean
}) {
  const { sessionToken } = useAdminSession()
  if (!sessionToken) return null
  // A fresh confirmation step for each profile and state.
  return (
    <Controls
      key={`${profileId}-${hidden}`}
      sessionToken={sessionToken}
      profileId={profileId}
      hidden={hidden}
    />
  )
}

function Controls({
  sessionToken,
  profileId,
  hidden,
}: {
  sessionToken: string
  profileId: Id<'profiles'>
  hidden: boolean
}) {
  const { setHidden, pending, error } = useProfileActions(sessionToken)
  const [confirming, setConfirming] = useState(false)
  const busy = pending !== undefined

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <div className="flex items-center gap-1" role="group" aria-label="Admin">
        <ShieldIcon className="size-3.5 text-muted-foreground" aria-hidden />
        {hidden ? (
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => void setHidden(profileId, false)}
          >
            <EyeIcon />
            {busy ? 'Unhiding…' : 'Unhide profile'}
          </Button>
        ) : confirming ? (
          <>
            <Button
              size="xs"
              variant="destructive"
              disabled={busy}
              onClick={() => void setHidden(profileId, true)}
            >
              <EyeOffIcon />
              {busy ? 'Hiding…' : 'Confirm hiding profile'}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Cancel hiding"
              onClick={() => setConfirming(false)}
            >
              <XIcon />
            </Button>
          </>
        ) : (
          <Button size="xs" variant="destructive" onClick={() => setConfirming(true)}>
            <EyeOffIcon />
            Hide profile
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
