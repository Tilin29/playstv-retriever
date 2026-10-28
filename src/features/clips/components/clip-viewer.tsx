import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Clip } from '../hooks/use-clips'
import { formatDate } from '../lib/format'

/** Plays a recovered clip straight from the Wayback Machine; the video itself isn't stored. */
export function ClipViewer({ clip, onClose }: { clip: Clip | null; onClose: () => void }) {
  // Keep showing the last clip while the dialog animates closed.
  const [shownClip, setShownClip] = useState(clip)
  if (clip && clip !== shownClip) setShownClip(clip)

  const videoUrl = shownClip?.videoUrl ?? null
  const details = shownClip
    ? [
        shownClip.gameName,
        shownClip.uploadedAt !== null ? formatDate(shownClip.uploadedAt) : null,
        shownClip.videoQuality ? `${shownClip.videoQuality}p` : null,
      ].filter(Boolean)
    : []

  return (
    <Dialog open={clip !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug">{shownClip?.title}</DialogTitle>
          {details.length > 0 && <DialogDescription>{details.join(' · ')}</DialogDescription>}
        </DialogHeader>
        {videoUrl && (
          <video
            key={videoUrl}
            src={videoUrl}
            poster={shownClip?.thumbnailUrl ?? undefined}
            controls
            autoPlay
            playsInline
            className="aspect-video w-full rounded-lg bg-black"
          />
        )}
        {videoUrl && (
          <DialogFooter>
            {/* The Archive doesn't allow cross-site downloads, so this opens the raw
                video in a new tab, where it can be saved. */}
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              download
              className={buttonVariants()}
            >
              <DownloadIcon />
              Download
            </a>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
