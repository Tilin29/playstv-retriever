// The viewer's player settings, remembered in this browser only. Storage can be
// unavailable (private windows, blocked site data), so every access falls back.

export type PlayerSettings = {
  /** 0 to 1. */
  volume: number
  muted: boolean
  /** Continue to the next clip when one ends. */
  autoplayNext: boolean
}

const STORAGE_KEY = 'player-settings'
const DEFAULT_SETTINGS: PlayerSettings = { volume: 1, muted: false, autoplayNext: true }

export function readPlayerSettings(): PlayerSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS
    const { volume, muted, autoplayNext } = stored as Partial<Record<keyof PlayerSettings, unknown>>
    return {
      volume:
        typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : DEFAULT_SETTINGS.volume,
      muted: muted === true,
      autoplayNext: autoplayNext !== false,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writePlayerSettings(settings: PlayerSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Not remembered this time; the player still works.
  }
}
