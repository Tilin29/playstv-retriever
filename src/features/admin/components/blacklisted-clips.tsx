import { BanIcon, Undo2Icon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { reportReasonLabel } from '@/features/reports'
import { useClipActions, type BlacklistedClip } from '../hooks/use-moderation'
import { formatDateTime } from '../lib/format'
import { ModeratedClip } from './moderated-clip'

export function BlacklistedClips({
  sessionToken,
  blacklisted,
}: {
  sessionToken: string
  blacklisted: BlacklistedClip[] | undefined
}) {
  const { run, pending, error } = useClipActions(sessionToken)

  if (blacklisted === undefined) return <Skeleton className="h-48" />

  if (blacklisted.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BanIcon />
          </EmptyMedia>
          <EmptyTitle>No blacklisted clips</EmptyTitle>
          <EmptyDescription>Clips you blacklist are hidden from everyone else.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {blacklisted.map((entry) => {
        const clipId = entry.clip._id
        const busy = pending?.clipId === clipId
        return (
          <ModeratedClip
            key={clipId}
            clip={entry.clip}
            actions={
              <Button variant="outline" disabled={busy} onClick={() => void run('restore', clipId)}>
                <Undo2Icon />
                {busy ? 'Restoring…' : 'Restore'}
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">
              Blacklisted {formatDateTime(entry.blacklistedAt)}
              {entry.reason && ` · ${reportReasonLabel(entry.reason)}`}
            </p>
          </ModeratedClip>
        )
      })}
    </div>
  )
}
