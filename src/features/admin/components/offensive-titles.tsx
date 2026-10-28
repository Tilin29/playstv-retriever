import { useState } from 'react'
import {
  BanIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  Undo2Icon,
} from 'lucide-react'
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
import { Spinner } from '@/components/ui/spinner'
import {
  useClipActions,
  useTitleFlags,
  useTitleScan,
  type FlaggedTitle,
  type TitleScan,
} from '../hooks/use-moderation'
import { formatDateTime } from '../lib/format'
import { ModeratedClip } from './moderated-clip'

const CATEGORY_LABELS: Record<FlaggedTitle['matches'][number]['category'], string> = {
  racial: 'Racial slur',
  antisemitic: 'Antisemitic slur',
  homophobic: 'Homophobic slur',
  transphobic: 'Transphobic slur',
  ableist: 'Ableist slur',
}

/** Clips whose titles contain a slur, open ones (passed in) or resolved ones. */
export function OffensiveTitles({
  sessionToken,
  open,
}: {
  sessionToken: string
  open: FlaggedTitle[] | undefined
}) {
  const [showResolved, setShowResolved] = useState(false)
  const resolved = useTitleFlags(sessionToken, 'resolved', showResolved) ?? undefined
  const flagged = showResolved ? resolved : open

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScanControls sessionToken={sessionToken} />
        <Button variant="outline" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Show open' : 'Show resolved'}
        </Button>
      </div>
      <FlaggedTitles sessionToken={sessionToken} flagged={flagged} resolved={showResolved} />
    </div>
  )
}

function ScanControls({ sessionToken }: { sessionToken: string }) {
  const { scan, start, starting, error } = useTitleScan(sessionToken)
  const running = scan?.status === 'running'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={scan === undefined || running || starting} onClick={() => void start()}>
          {running || starting ? <Spinner /> : <ScanSearchIcon />}
          {running ? 'Scanning…' : 'Scan all titles'}
        </Button>
        {scan && <ScanStatus scan={scan} />}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ScanStatus({ scan }: { scan: TitleScan }) {
  const counts =
    `${scan.scanned.toLocaleString()} titles checked, ` +
    `${scan.flagged.toLocaleString()} newly flagged`
  return (
    <p className="text-sm text-muted-foreground">
      {scan.status === 'running'
        ? `${counts} so far`
        : `Last scan ${formatDateTime(scan.finishedAt ?? scan.startedAt)}: ${counts}`}
    </p>
  )
}

function FlaggedTitles({
  sessionToken,
  flagged,
  resolved,
}: {
  sessionToken: string
  flagged: FlaggedTitle[] | undefined
  resolved: boolean
}) {
  const { run, pending, error } = useClipActions(sessionToken)

  if (flagged === undefined) return <Skeleton className="h-48" />

  if (flagged.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{resolved ? 'No resolved titles' : 'No offensive titles'}</EmptyTitle>
          <EmptyDescription>
            {resolved
              ? 'Titles you mark resolved show up here.'
              : 'New clips are checked as they are stored. Scan all titles to check older ones.'}
          </EmptyDescription>
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
      {flagged.map((entry) => {
        const clipId = entry.clip._id
        const busy = pending?.clipId === clipId
        return (
          <ModeratedClip
            key={clipId}
            clip={entry.clip}
            actions={
              <>
                {resolved ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run('reopenTitleFlag', clipId)}
                  >
                    <Undo2Icon />
                    {busy && pending.action === 'reopenTitleFlag' ? 'Reopening…' : 'Reopen'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run('resolveTitleFlag', clipId)}
                    >
                      <CheckIcon />
                      {busy && pending.action === 'resolveTitleFlag'
                        ? 'Resolving…'
                        : 'Mark resolved'}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void run('blacklist', clipId)}
                    >
                      <BanIcon />
                      {busy && pending.action === 'blacklist' ? 'Blacklisting…' : 'Blacklist'}
                    </Button>
                  </>
                )}
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
              {entry.matches.map((match) => (
                <Badge key={match.word} variant="destructive">
                  {CATEGORY_LABELS[match.category]}:
                  <span className="font-mono">{match.text}</span>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Flagged {formatDateTime(entry.flaggedAt)}
              {entry.resolvedAt !== null && ` · Resolved ${formatDateTime(entry.resolvedAt)}`}
            </p>
          </ModeratedClip>
        )
      })}
    </div>
  )
}
