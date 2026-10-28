// Mirror CLIP_LINK_PATTERN and SHORT_LINK_CODE_PATTERN in convex/model/playstv.ts.
const CLIP_LINK_PATTERN = /plays\.tv\/(?:video|embeds)\/([A-Za-z0-9]{6,32})/i
const SHORT_LINK_PATTERN = /plays\.tv\/s\/([A-Za-z0-9_-]{6,32})/i
const LINK_KEY_PATTERN = /^(?:[A-Za-z0-9]{6,32}|s:[A-Za-z0-9_-]{6,32})$/

export const MAX_CLIP_LINKS = 50

/**
 * Reads one link per line. Returns a key for each clip link (each once, in order): the
 * clip's page id, or `s:<code>` for a share link. `lines` has an entry for every line,
 * blank ones included, so it lines up with the text: 'valid', 'invalid' or 'blank'.
 */
export function parseClipLinks(text: string) {
  const keys: string[] = []
  const lines: ('valid' | 'invalid' | 'blank')[] = []
  for (const line of text.split('\n').map((line) => line.trim())) {
    if (!line) {
      lines.push('blank')
      continue
    }
    const videoId = CLIP_LINK_PATTERN.exec(line)?.[1]
    const shortCode = SHORT_LINK_PATTERN.exec(line)?.[1]
    const key = videoId ?? (shortCode ? `s:${shortCode}` : null)
    lines.push(key ? 'valid' : 'invalid')
    if (key && !keys.includes(key)) keys.push(key)
  }
  return { keys, lines, invalidCount: lines.filter((line) => line === 'invalid').length }
}

export function isLinkKey(key: string) {
  return LINK_KEY_PATTERN.test(key)
}

/** The link a key stands for, for display. */
export function linkKeyLabel(key: string) {
  return key.startsWith('s:') ? `plays.tv/s/${key.slice(2)}` : `plays.tv/video/${key}`
}
