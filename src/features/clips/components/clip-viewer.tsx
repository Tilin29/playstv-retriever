import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  LinkIcon,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Clip } from '../hooks/use-clips'
import { formatDate } from '../lib/format'
import { VideoPlayer } from './video-player'

/** The profile a clip belongs to. */
export type ClipOwner = {
  username: string
  usernameKey: string
  avatarUrl: string | null
}

const COPIED_NOTICE_MS = 2000

/**
 * Plays a recovered clip straight from the Wayback Machine; the video itself isn't
 * stored. Arrows (and ←/→) step to the neighbouring clips when there are any.
 */
export function ClipViewer({
  clip,
  owner,
  onClose,
  onPrevious,
  onNext,
}: {
  clip: Clip | null
  owner: ClipOwner | null
  onClose: () => void
  /** Opens the clip before this one; null when this is the first. */
  onPrevious: (() => void) | null
  /** Opens the clip after this one; null when this is the last. */
  onNext: (() => void) | null
}) {
  useArrowKeys(clip !== null, onPrevious, onNext)

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
        {/* Beside the popup on wide screens; over the video's edges where there's no room. */}
        <StepButton label="Previous clip" onClick={onPrevious} className="left-6 lg:-left-14">
          <ChevronLeftIcon className="size-6" />
        </StepButton>
        <StepButton label="Next clip" onClick={onNext} className="right-6 lg:-right-14">
          <ChevronRightIcon className="size-6" />
        </StepButton>
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
          <VideoPlayer
            key={videoUrl}
            src={videoUrl}
            poster={shownClip?.thumbnailUrl ?? undefined}
            onNext={onNext}
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

function StepButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: (() => void) | null
  className: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant="outline"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={onClick ?? undefined}
      className={cn(
        // Solid and large so they stand out over the dimmed page and the video; slightly
        // faded at rest, full strength on hover or focus.
        'absolute top-1/2 z-10 size-12 -translate-y-1/2 rounded-full bg-background/90 opacity-80 shadow-lg backdrop-blur-sm hover:opacity-100 focus-visible:opacity-100 dark:bg-background/90',
        // Over the video a disabled arrow is just in the way; beside it, it shows the end.
        'disabled:opacity-0 lg:disabled:opacity-25',
        className,
      )}
    >
      {children}
    </Button>
  )
}

/** ←/→ step through clips while the viewer is open, unless a slider (seek, volume) has focus. */
function useArrowKeys(open: boolean, onPrevious: (() => void) | null, onNext: (() => void) | null) {
  const handlers = useRef({ onPrevious, onNext })
  useEffect(() => {
    handlers.current = { onPrevious, onNext }
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('video, input, textarea')) {
        return
      }
      const step =
        event.key === 'ArrowLeft'
          ? handlers.current.onPrevious
          : event.key === 'ArrowRight'
            ? handlers.current.onNext
            : null
      if (!step) return
      event.preventDefault()
      step()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])
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
