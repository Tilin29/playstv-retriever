import { BanIcon, CheckIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { useClipActions, type ReportedClip } from '../hooks/use-moderation'
import { formatDateTime } from '../lib/format'
import { ModeratedClip } from './moderated-clip'

export function ReportedClips({
  sessionToken,
  reported,
}: {
  sessionToken: string
  reported: ReportedClip[] | undefined
}) {
  const { run, pending, error } = useClipActions(sessionToken)

  if (reported === undefined) return <Skeleton className="h-48" />

  if (reported.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>No open reports</EmptyTitle>
          <EmptyDescription>Reported clips show up here for review.</EmptyDescription>
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
      {reported.map((entry) => {
        const clipId = entry.clip._id
        const busy = pending?.clipId === clipId
        return (
          <ModeratedClip
            key={clipId}
            clip={entry.clip}
            actions={
              <>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void run('blacklist', clipId)}
                >
                  <BanIcon />
                  {busy && pending.action === 'blacklist' ? 'Blacklisting…' : 'Blacklist'}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void run('dismiss', clipId)}>
                  <CheckIcon />
                  {busy && pending.action === 'dismiss' ? 'Dismissing…' : 'Keep up'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(entry.clip.titleHidden ? 'showTitle' : 'hideTitle', clipId)
                  }
                >
                  {entry.clip.titleHidden ? <EyeIcon /> : <EyeOffIcon />}
                  {entry.clip.titleHidden ? 'Show title' : 'Hide title'}
                </Button>
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">
                {entry.reportCount} {entry.reportCount === 1 ? 'report' : 'reports'}
              </span>
              {entry.reasons.map(({ reason, count }) => (
                <Badge key={reason} variant="secondary">
                  {reportReasonLabel(reason)}
                  {count > 1 && ` ×${count}`}
                </Badge>
              ))}
            </div>
            <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto text-sm">
              {entry.reports.map((report) => (
                <li key={report._id} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {reportReasonLabel(report.reason)} · {formatDateTime(report.reportedAt)}
                  </span>
                  {report.details && <span className="break-words">{report.details}</span>}
                </li>
              ))}
            </ul>
          </ModeratedClip>
        )
      })}
    </div>
  )
}
