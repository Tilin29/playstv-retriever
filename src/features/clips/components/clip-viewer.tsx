import { useEffect, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { CheckIcon, DownloadIcon, LinkIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
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

/** The profile a clip belongs to. */
export type ClipOwner = {
  username: string
  usernameKey: string
  avatarUrl: string | null
}

const COPIED_NOTICE_MS = 2000

/** Plays a recovered clip straight from the Wayback Machine; the video itself isn't stored. */
export function ClipViewer({
  clip,
  owner,
  onClose,
}: {
  clip: Clip | null
  owner: ClipOwner | null
  onClose: () => void
}) {
  // Keep showing the last clip while the dialog animates closed.
  const [shown, setShown] = useState({ clip, owner })
  if (clip && clip !== shown.clip) setShown({ clip, owner })
  const { clip: shownClip, owner: shownOwner } = shown

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
          {shownOwner && (
            <Link
              to="/u/$username"
              params={{ username: shownOwner.usernameKey }}
              className="flex w-fit items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Avatar size="sm">
                {shownOwner.avatarUrl && <AvatarImage src={shownOwner.avatarUrl} alt="" />}
                <AvatarFallback>{shownOwner.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {shownOwner.username}
            </Link>
          )}
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
            {shownClip && shownOwner && (
              <CopyClipLinkButton clipId={shownClip._id} usernameKey={shownOwner.usernameKey} />
            )}
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

/** Copies a link that opens this clip on its owner's profile. */
function CopyClipLinkButton({ clipId, usernameKey }: { clipId: Clip['_id']; usernameKey: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  async function copy() {
    const { href } = router.buildLocation({
      to: '/u/$username',
      params: { username: usernameKey },
      search: { clip: clipId },
    })
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString())
      setCopied(true)
    } catch {
      // Clipboard access can be refused (e.g. an insecure context); there's nothing to undo.
    }
  }

  return (
    <Button variant="outline" onClick={() => void copy()}>
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}
