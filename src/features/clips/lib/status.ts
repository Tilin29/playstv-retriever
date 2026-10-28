import type { Clip } from '../hooks/use-clips'

export function isUnrecoverable(clip: Clip) {
  return clip.videoStatus === 'unavailable' || clip.videoStatus === 'failed'
}

/** Whether the full-length video was found and can be played. */
export function isWatchable(clip: Clip) {
  return clip.videoStatus === 'available' && clip.videoUrl !== null
}

export function isChecking(clip: Clip) {
  return clip.videoStatus === 'checking' || clip.videoStatus === 'rechecking'
}
