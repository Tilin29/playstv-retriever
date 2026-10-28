import type { Clip } from '../hooks/use-clips'

export function isUnrecoverable(clip: Clip) {
  return clip.videoStatus === 'unavailable' || clip.videoStatus === 'failed'
}

export function isChecking(clip: Clip) {
  return clip.videoStatus === 'checking' || clip.videoStatus === 'rechecking'
}
