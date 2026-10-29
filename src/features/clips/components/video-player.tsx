import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCwIcon,
  ShuffleIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatDuration } from '../lib/format'
import { readPlayerSettings, writePlayerSettings, type PlayerSettings } from '../lib/player-settings'

const NEXT_CLIP_COUNTDOWN_SECONDS = 3
const CONTROLS_HIDE_DELAY_MS = 2500
const SEEK_STEP_SECONDS = 5

/**
 * Plays a clip with themed controls. The video streams from the Wayback Machine, which
 * is often slow, so buffering and load failures get their own screens. Shortcuts:
 * Space/K play, J/L seek, M mute, F fullscreen (←/→ are left to the viewer for
 * switching clips).
 */
export function VideoPlayer({
  src,
  poster,
  onNext,
  shuffle,
  onShuffleChange,
}: {
  src: string
  poster: string | undefined
  /** Plays the next clip; null when there's none. */
  onNext: (() => void) | null
  /** Shows the shuffle toggle when given. */
  shuffle?: boolean
  onShuffleChange?: (shuffle: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [settings, setSettings] = useState(readPlayerSettings)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const updateSettings = (change: Partial<PlayerSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...change }
      writePlayerSettings(next)
      return next
    })
  }

  // Also re-applied when a retry swaps in a new video element.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = settings.volume
    video.muted = settings.muted
  }, [settings.volume, settings.muted, attempt])

  // Start playing; browsers may refuse with sound, which leaves the big play button.
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [attempt])

  // Counts down to the next clip once one ends.
  const onNextRef = useRef(onNext)
  useEffect(() => {
    onNextRef.current = onNext
  })
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      onNextRef.current?.()
      return
    }
    const timeout = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timeout)
  }, [countdown])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    setCountdown(null)
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }
  const seekBy = (seconds: number) => {
    const video = videoRef.current
    if (video) video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void containerRef.current?.requestFullscreen().catch(() => {})
  }
  const toggleMute = () => updateSettings({ muted: !settings.muted || settings.volume === 0 })

  const shortcuts = useRef({ togglePlay, seekBy, toggleMute, toggleFullscreen })
  useEffect(() => {
    shortcuts.current = { togglePlay, seekBy, toggleMute, toggleFullscreen }
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      // Space activates a focused button or slider; leave that to the browser.
      if (event.key === ' ' && target?.closest('button, a, input')) return
      const { togglePlay, seekBy, toggleMute, toggleFullscreen } = shortcuts.current
      const action = {
        ' ': togglePlay,
        k: togglePlay,
        j: () => seekBy(-SEEK_STEP_SECONDS),
        l: () => seekBy(SEEK_STEP_SECONDS),
        m: toggleMute,
        f: toggleFullscreen,
      }[event.key.toLowerCase()]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const showActivity = () => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), CONTROLS_HIDE_DELAY_MS)
  }

  const retry = () => {
    setFailed(false)
    setWaiting(true)
    setAttempt((count) => count + 1)
  }

  const muted = settings.muted || settings.volume === 0
  const controlsHidden = playing && idle && !waiting && !failed
  const overlay = failed ? (
    <Overlay>
      <AlertCircleIcon className="size-8" />
      <p className="font-medium">Couldn't load the video</p>
      <p className="max-w-xs text-center text-sm text-white/70">
        The Wayback Machine may be slow or briefly offline.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={retry}>
          <RotateCwIcon data-icon="inline-start" />
          Try again
        </Button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium text-white hover:bg-white/15"
        >
          Open in new tab
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </div>
    </Overlay>
  ) : countdown !== null ? (
    <Overlay>
      <p className="text-sm text-white/70">Next clip in</p>
      <p className="text-4xl font-semibold tabular-nums">{countdown}</p>
      <div className="mt-1 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onNext?.()}>
          <SkipForwardIcon data-icon="inline-start" />
          Play now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={() => setCountdown(null)}
        >
          Cancel
        </Button>
      </div>
    </Overlay>
  ) : waiting ? (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <Spinner className="size-10 text-white" />
    </div>
  ) : !playing ? (
    <button
      type="button"
      aria-label="Play"
      onClick={togglePlay}
      className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-black/60 text-white outline-none hover:bg-black/75 focus-visible:ring-3 focus-visible:ring-white/60"
    >
      <PlayIcon className="size-7 translate-x-0.5 fill-current" />
    </button>
  ) : null

  return (
    <div
      ref={containerRef}
      data-fullscreen={fullscreen || undefined}
      onPointerMove={showActivity}
      onPointerDown={showActivity}
      className={cn(
        // Sized to fit the popup on short screens, keeping the 16:9 frame.
        'group/player relative mx-auto aspect-video w-full max-w-[max(16rem,calc((100svh-16rem)*16/9))] overflow-hidden rounded-lg bg-black text-white select-none',
        'data-fullscreen:aspect-auto data-fullscreen:size-full data-fullscreen:max-w-none data-fullscreen:rounded-none',
        controlsHidden && 'cursor-none',
      )}
    >
      <video
        key={attempt}
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onError={() => {
          setFailed(true)
          setWaiting(false)
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onProgress={(event) => {
          const { buffered } = event.currentTarget
          if (buffered.length > 0) setBufferedEnd(buffered.end(buffered.length - 1))
        }}
        onEnded={() => {
          setPlaying(false)
          if (settings.autoplayNext && onNext) setCountdown(NEXT_CLIP_COUNTDOWN_SECONDS)
        }}
        className="size-full object-contain"
      />
      {overlay}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pt-8 pb-2 transition-opacity duration-300',
          (controlsHidden || failed) && 'pointer-events-none opacity-0',
        )}
      >
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          onSeek={(time) => {
            const video = videoRef.current
            if (video) video.currentTime = time
            setCountdown(null)
          }}
        />
        <div className="flex items-center gap-1">
          <ControlButton label={playing ? 'Pause (K)' : 'Play (K)'} onClick={togglePlay}>
            {playing ? (
              <PauseIcon className="fill-current" />
            ) : (
              <PlayIcon className="fill-current" />
            )}
          </ControlButton>
          <div className="group/volume flex items-center">
            <ControlButton label={muted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute}>
              {muted ? <VolumeXIcon /> : <Volume2Icon />}
            </ControlButton>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : settings.volume}
              onChange={(event) =>
                updateSettings({ volume: Number(event.target.value), muted: false })
              }
              className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
            />
          </div>
          <span className="ml-2 text-xs text-white/80 tabular-nums">
            {formatDuration(Math.floor(currentTime))}
            {duration > 0 && ` / ${formatDuration(Math.floor(duration))}`}
          </span>
          <div className="flex-1" />
          {shuffle !== undefined && onShuffleChange && (
            <ControlButton
              label={shuffle ? 'Shuffle on' : 'Shuffle off'}
              pressed={shuffle}
              onClick={() => onShuffleChange(!shuffle)}
            >
              <ShuffleIcon />
            </ControlButton>
          )}
          <button
            type="button"
            aria-pressed={settings.autoplayNext}
            title="Continue to the next clip when this one ends"
            onClick={() => updateSettings({ autoplayNext: !settings.autoplayNext })}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-white/80 outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span
              aria-hidden
              className={cn(
                'relative h-3.5 w-6 rounded-full transition-colors',
                settings.autoplayNext ? 'bg-white' : 'bg-white/30',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-2.5 rounded-full bg-black transition-[left]',
                  settings.autoplayNext ? 'left-3' : 'left-0.5',
                )}
              />
            </span>
            Autoplay
          </button>
          <ControlButton
            label={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </ControlButton>
        </div>
      </div>
    </div>
  )
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4">
      {children}
    </div>
  )
}

function ControlButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  /** Makes it a toggle, dimmed while off. */
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-md text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 [&_svg]:size-4.5',
        pressed === false && 'text-white/50 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

/** The played part, what's buffered so far, and an invisible range input that does the work. */
function SeekBar({
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
}: {
  currentTime: number
  duration: number
  bufferedEnd: number
  onSeek: (time: number) => void
}) {
  const percent = (time: number) => (duration > 0 ? `${(time / duration) * 100}%` : '0%')
  return (
    <div className="group/seek relative flex h-4 items-center">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: percent(bufferedEnd) }} />
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: percent(currentTime) }} />
      </div>
      <div
        className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/seek:opacity-100 group-has-focus-visible/seek:opacity-100"
        style={{ left: percent(currentTime) }}
      />
      <input
        type="range"
        aria-label="Seek"
        aria-valuetext={`${formatDuration(Math.floor(currentTime))} of ${formatDuration(Math.floor(duration))}`}
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </div>
  )
}
