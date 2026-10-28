import { useState } from 'react'
import { ClockIcon, ImageOffIcon, RotateCwIcon, SearchXIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { Clip } from '../hooks/use-clips'
import { useRetryClipVideo } from '../hooks/use-retry-clip-video'
import { formatDate, formatDuration } from '../lib/format'
import { isChecking, isUnrecoverable, isWatchable } from '../lib/status'
import { ClipTitle, clipTitleText } from './clip-title'

const VIDEO_STATUS_NOTES: Partial<Record<Clip['videoStatus'], string>> = {
  checking: 'Checking the archive…',
  rechecking: 'Checking the archive…',
  unavailable: "Couldn't be recovered",
  failed: "The archive didn't respond",
}

export function ClipCard({
  clip,
  justLost,
  onOpen,
}: {
  clip: Clip
  /** The check just finished without finding the video. */
  justLost: boolean
  onOpen: () => void
}) {
  const [previewing, setPreviewing] = useState(false)
  // Media that failed to load (e.g. the Archive timing out). A stored copy has a
  // different URL, so it is tried again once it arrives.
  const [brokenUrls, setBrokenUrls] = useState<ReadonlySet<string>>(new Set())
  const thumbnailUrl =
    clip.thumbnailUrl && !brokenUrls.has(clip.thumbnailUrl) ? clip.thumbnailUrl : null
  const previewUrl = clip.previewUrl && !brokenUrls.has(clip.previewUrl) ? clip.previewUrl : null
  const videoUrl = isWatchable(clip) ? clip.videoUrl : null
  const unrecoverable = isUnrecoverable(clip)
  const checking = isChecking(clip)

  const details = [
    clip.gameName,
    clip.uploadedAt !== null ? formatDate(clip.uploadedAt) : null,
    videoUrl && clip.videoQuality ? `${clip.videoQuality}p` : null,
    VIDEO_STATUS_NOTES[clip.videoStatus],
  ].filter(Boolean)

  const card = (
    <Card
      className={cn(
        'h-full pt-0 transition',
        videoUrl && 'group-hover:ring-foreground/30',
        // The preview of a lost clip plays in full colour so it can still be recognised.
        // A clip that was just found missing stays in colour while its notice shows.
        unrecoverable && !justLost && !(previewing && previewUrl) && 'opacity-60 grayscale',
      )}
    >
      <div className="relative aspect-video bg-muted">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOffIcon />
        </div>
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setBrokenUrls((urls) => new Set(urls).add(thumbnailUrl))}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {previewing && previewUrl && (
          <video
            src={previewUrl}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setBrokenUrls((urls) => new Set(urls).add(previewUrl))}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {checking && (
          <Badge
            variant="secondary"
            title="Checking if the full video can be recovered"
            className="absolute top-2 left-2"
          >
            <ClockIcon className="animate-pulse" />
            Checking
          </Badge>
        )}
        {justLost && (
          <Badge variant="destructive" className="absolute top-2 left-2 bg-background">
            <SearchXIcon />
            Clip not found
          </Badge>
        )}
        {clip.durationSeconds !== null && (
          <Badge variant="secondary" className="absolute right-2 bottom-2 tabular-nums">
            {formatDuration(clip.durationSeconds)}
          </Badge>
        )}
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">
          <ClipTitle clip={clip} />
        </CardTitle>
        <CardDescription>{details.join(' · ')}</CardDescription>
        {clip.videoStatus === 'failed' && (
          <CardAction>
            <RetryVideoButton clipId={clip._id} />
          </CardAction>
        )}
      </CardHeader>
    </Card>
  )

  const previewHandlers = {
    onPointerEnter: () => setPreviewing(true),
    onPointerLeave: () => setPreviewing(false),
  }

  if (!videoUrl) {
    return (
      <div aria-disabled={unrecoverable || undefined} {...previewHandlers}>
        {card}
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-label={`Watch "${clipTitleText(clip)}"`}
      className="group block w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={() => {
        setPreviewing(false)
        onOpen()
      }}
      onFocus={() => setPreviewing(true)}
      onBlur={() => setPreviewing(false)}
      {...previewHandlers}
    >
      {card}
    </button>
  )
}

/** For clips whose check failed because the Archive didn't respond. */
function RetryVideoButton({ clipId }: { clipId: Clip['_id'] }) {
  const { retry, pending, error } = useRetryClipVideo(clipId)
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={() => void retry()}
      title={error ?? 'Check the Wayback Machine for this clip again'}
      aria-invalid={error ? true : undefined}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <RotateCwIcon data-icon="inline-start" />}
      Try again
    </Button>
  )
}
