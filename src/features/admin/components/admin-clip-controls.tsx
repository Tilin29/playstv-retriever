import { useState } from 'react'
import { BanIcon, EyeIcon, EyeOffIcon, ShieldIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Id } from '@convex/_generated/dataModel'
import { useAdminSession } from '../hooks/use-admin-session'
import { useClipActions, useModeratedClip } from '../hooks/use-moderation'

/**
 * Moderation buttons for the clip viewer, shown only to a signed-in admin: hide or show
 * the title, and blacklist the clip. Meant to sit in a wrapping flex row beside the title;
 * a hidden title's real text drops onto its own line below. Every action is checked
 * server-side.
 */
export function AdminClipControls({ clipId }: { clipId: Id<'clips'> }) {
  const { sessionToken } = useAdminSession()
  if (!sessionToken) return null
  // A fresh confirmation step for each clip.
  return <Controls key={clipId} sessionToken={sessionToken} clipId={clipId} />
}

function Controls({ sessionToken, clipId }: { sessionToken: string; clipId: Id<'clips'> }) {
  const clip = useModeratedClip(sessionToken, clipId)
  const { run, pending, error } = useClipActions(sessionToken)
  const [confirmingBlacklist, setConfirmingBlacklist] = useState(false)
  if (!clip) return null
  const busy = pending !== undefined

  return (
    <>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Admin">
        <ShieldIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <Button
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => void run(clip.titleHidden ? 'showTitle' : 'hideTitle', clipId)}
        >
          {clip.titleHidden ? <EyeIcon /> : <EyeOffIcon />}
          {clip.titleHidden ? 'Show title' : 'Hide title'}
        </Button>
        {confirmingBlacklist ? (
          <>
            <Button
              size="xs"
              variant="destructive"
              disabled={busy}
              onClick={() => void run('blacklist', clipId)}
            >
              <BanIcon />
              {pending?.action === 'blacklist' ? 'Blacklisting…' : 'Confirm'}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Cancel blacklisting"
              onClick={() => setConfirmingBlacklist(false)}
            >
              <XIcon />
            </Button>
          </>
        ) : (
          <Button size="xs" variant="destructive" onClick={() => setConfirmingBlacklist(true)}>
            <BanIcon />
            Blacklist
          </Button>
        )}
      </div>
      {clip.titleHidden && (
        <p className="order-last basis-full text-sm break-words text-muted-foreground">
          Hidden title: <span className="text-foreground">{clip.title}</span>
        </p>
      )}
      {error && <p className="order-last basis-full text-sm text-destructive">{error}</p>}
    </>
  )
}
