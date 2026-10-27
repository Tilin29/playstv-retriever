import { useState } from 'react'
import { ImageOffIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Clip } from '../hooks/use-clips'
import { formatDate, formatDuration } from '../lib/format'

const VIDEO_STATUS_NOTES: Partial<Record<Clip['videoStatus'], string>> = {
  checking: 'Checking the archive…',
  unavailable: "Couldn't be recovered",
  failed: "The archive didn't respond – retrying on your next visit",
}

export function ClipCard({ clip }: { clip: Clip }) {
  const [previewing, setPreviewing] = useState(false)
  const videoUrl = clip.videoStatus === 'available' ? clip.videoUrl : null
  const unrecoverable = clip.videoStatus === 'unavailable' || clip.videoStatus === 'failed'

  const details = [
    clip.uploadedAt !== null ? formatDate(clip.uploadedAt) : null,
    videoUrl && clip.videoQuality ? `${clip.videoQuality}p` : null,
    VIDEO_STATUS_NOTES[clip.videoStatus],
  ].filter(Boolean)

  const card = (
    <Card
      className={cn(
        'h-full pt-0 transition',
        videoUrl && 'group-hover:ring-foreground/30',
        unrecoverable && 'opacity-60 grayscale',
      )}
    >
      <div className="relative aspect-video bg-muted">
        {clip.mediaStatus === 'pending' ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageOffIcon />
          </div>
        )}
        {previewing && clip.previewUrl && (
          <video
            src={clip.previewUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {clip.durationSeconds !== null && (
          <Badge variant="secondary" className="absolute right-2 bottom-2 tabular-nums">
            {formatDuration(clip.durationSeconds)}
          </Badge>
        )}
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">{clip.title}</CardTitle>
        <CardDescription>{details.join(' · ')}</CardDescription>
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
    <a
      href={videoUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Watch "${clip.title}" (archived video)`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onFocus={() => setPreviewing(true)}
      onBlur={() => setPreviewing(false)}
      {...previewHandlers}
    >
      {card}
    </a>
  )
}
