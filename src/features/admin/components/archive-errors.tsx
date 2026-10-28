import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckIcon, CloudOffIcon, RotateCwIcon, XIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import type { Id } from '@convex/_generated/dataModel'
import {
  useFailedVideoChecks,
  useRetryVideoChecks,
  useVideoChecks,
  type VideoCheck,
} from '../hooks/use-moderation'

/**
 * Clips whose full-video check failed because the Archive didn't respond, to check
 * again. Every clip seen here stays listed with its current result until the page is
 * reloaded, so retries can be followed to "found" or "not found".
 */
export function ArchiveErrors({ sessionToken }: { sessionToken: string }) {
  const failed = useFailedVideoChecks(sessionToken)
  const [tracked, setTracked] = useState<Id<'clips'>[]>([])
  const newlyFailed = failed?.filter((clip) => !tracked.includes(clip._id)) ?? []
  if (newlyFailed.length > 0) setTracked([...tracked, ...newlyFailed.map((clip) => clip._id)])
  const checks = useVideoChecks(sessionToken, tracked)
  const { run, pending, error } = useRetryVideoChecks(sessionToken)

  if (failed === undefined || failed === null) return <Skeleton className="h-48" />
  const rows = checks ?? failed

  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CloudOffIcon />
          </EmptyMedia>
          <EmptyTitle>No archive errors</EmptyTitle>
          <EmptyDescription>
            Clips whose check failed because the Wayback Machine didn't respond show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const count = (statuses: VideoCheck['videoStatus'][]) =>
    rows.filter((row) => statuses.includes(row.videoStatus)).length
  const summary = [
    [count(['failed']), 'no response'],
    [count(['checking', 'rechecking']), 'checking'],
    [count(['available']), 'found'],
    [count(['unavailable']), 'not found'],
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary
            .filter(([n]) => n > 0)
            .map(([n, label]) => `${n} ${label}`)
            .join(' · ')}
        </p>
        <Button disabled={failed.length === 0 || pending !== undefined} onClick={() => void run('all')}>
          {pending === 'all' ? <Spinner /> : <RotateCwIcon />}
          Retry all failed ({failed.length})
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((clip) => (
          <VideoCheckRow
            key={clip._id}
            clip={clip}
            retrying={pending === clip._id}
            onRetry={() => void run(clip._id)}
          />
        ))}
      </ul>
    </div>
  )
}

function VideoCheckRow({
  clip,
  retrying,
  onRetry,
}: {
  clip: VideoCheck
  retrying: boolean
  onRetry: () => void
}) {
  const { owner } = clip
  const checking = clip.videoStatus === 'checking' || clip.videoStatus === 'rechecking'
  const canRetry = clip.videoStatus === 'failed' || clip.videoStatus === 'unavailable'
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
      {clip.thumbnailUrl ? (
        <img
          src={clip.thumbnailUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-24 shrink-0 rounded-md bg-muted object-cover"
        />
      ) : (
        <div className="aspect-video w-24 shrink-0 rounded-md bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium break-words">{clip.title}</span>
        <Link
          to="/u/$username"
          params={{ username: owner.usernameKey }}
          className="flex w-fit items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Avatar size="sm">
            {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
            <AvatarFallback>{owner.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {owner.username}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <CheckStatus clip={clip} />
        <Button
          size="sm"
          variant="outline"
          disabled={!canRetry || retrying}
          title={clip.videoStatus === 'available' ? 'Already found' : undefined}
          onClick={onRetry}
        >
          {retrying || checking ? <Spinner /> : <RotateCwIcon />}
          Check again
        </Button>
      </div>
    </li>
  )
}

function CheckStatus({ clip }: { clip: VideoCheck }) {
  switch (clip.videoStatus) {
    case 'available':
      return (
        <Badge className="bg-emerald-600 text-white dark:bg-emerald-500">
          <CheckIcon />
          {clip.videoUrl ? (
            <a href={clip.videoUrl} target="_blank" rel="noreferrer" className="hover:underline">
              Found{clip.videoQuality ? ` · ${clip.videoQuality}p` : ''}
            </a>
          ) : (
            'Found'
          )}
        </Badge>
      )
    case 'unavailable':
      return (
        <Badge variant="destructive">
          <XIcon />
          Not found
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="secondary">
          <CloudOffIcon />
          No response
        </Badge>
      )
    default:
      return <Badge variant="outline">Checking…</Badge>
  }
}
