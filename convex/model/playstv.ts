// Parsing for archived Plays.tv pages. Pure functions: no Convex or network access.

export type ParsedClip = {
  videoId: string
  mediaId: string
  cdnHost: string
  title: string
  durationSeconds?: number
  uploadedAt?: number
}

export type ParsedProfilePage = {
  displayName: string | null
  avatarUrl: string | null
  clips: ParsedClip[]
}

type VideoObject = {
  '@type'?: string
  name?: string
  description?: string
  thumbnailURL?: string
  embedURL?: string
  duration?: string
  uploadDate?: string
}

const LD_JSON_PATTERN = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
const MEDIA_URL_PATTERN = /^(?:https?:)?\/\/([^/]+)\/video\/([^/]+)\/processed\//
const EMBED_URL_PATTERN = /\/embeds\/([A-Za-z0-9]+)/
const ISO_DURATION_PATTERN = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
const PROFILE_PAGE_PATTERN = /^https?:\/\/(?:www\.)?plays\.tv\/u\/([^/?#]+)(\/videos)?\/?$/i

/**
 * Ranks archived profile URLs worth scraping: 0 for /u/<name>/videos, 1 for /u/<name>.
 * Returns null for anything else (other users sharing the prefix, followers pages, ...).
 */
export function profilePagePriority(url: string, username: string): number | null {
  const match = PROFILE_PAGE_PATTERN.exec(url)
  if (!match || match[1].toLowerCase() !== username.toLowerCase()) return null
  return match[2] ? 0 : 1
}

/** Prefix covering every processed file of a clip, e.g. "d1playscdntv-a.akamaihd.net/video/<id>/". */
export function clipMediaPrefix(cdnHost: string, mediaId: string) {
  return `${cdnHost}/video/${mediaId}/`
}

/**
 * Plays.tv served media from two interchangeable CDN hosts (d0…/d1…), and the
 * Archive sometimes captured a clip's files under the other one.
 */
export function cdnHostVariants(cdnHost: string) {
  const match = /^d([01])(.*)$/.exec(cdnHost)
  if (!match) return [cdnHost]
  return [cdnHost, `d${match[1] === '0' ? '1' : '0'}${match[2]}`]
}

const PROCESSED_FILE_PATTERN = /\/processed\/([^/?#]+)$/
const FULL_VIDEO_PATTERN = /^(\d+)\.mp4$/

/** Name of a clip media file within its "processed" folder, e.g. "720.mp4". */
export function processedFileName(url: string) {
  return PROCESSED_FILE_PATTERN.exec(url)?.[1] ?? null
}

/** Picks the highest-quality full-length MP4 (e.g. "720.mp4" over "480.mp4"). */
export function pickFullVideo(fileNames: Iterable<string>) {
  let best: { fileName: string; quality: number } | null = null
  for (const fileName of fileNames) {
    const match = FULL_VIDEO_PATTERN.exec(fileName)
    const quality = match ? Number(match[1]) : 0
    if (quality > (best?.quality ?? 0)) best = { fileName, quality }
  }
  return best
}

/** Reads the clip list from the page's JSON-LD ProfilePage block, plus name and avatar. */
export function parseProfilePage(html: string): ParsedProfilePage {
  const clips = new Map<string, ParsedClip>()
  for (const [, json] of html.matchAll(LD_JSON_PATTERN)) {
    let data: unknown
    try {
      data = JSON.parse(json)
    } catch {
      continue
    }
    const videos = (data as { video?: unknown } | null)?.video
    if (!Array.isArray(videos)) continue
    for (const video of videos as VideoObject[]) {
      const clip = parseVideoObject(video)
      if (clip && !clips.has(clip.videoId)) clips.set(clip.videoId, clip)
    }
  }

  const ogTitle = readMeta(html, 'og:title')
  const displayName = ogTitle?.replace(/^Plays\.tv\s*-\s*/i, '').trim() || null
  const ogImage = readMeta(html, 'og:image')
  const avatarUrl = ogImage ? absoluteUrl(ogImage) : null

  return { displayName, avatarUrl, clips: [...clips.values()] }
}

function parseVideoObject(video: VideoObject): ParsedClip | null {
  if (video['@type'] !== 'VideoObject' || !video.thumbnailURL || !video.embedURL) return null
  const media = MEDIA_URL_PATTERN.exec(video.thumbnailURL)
  const embed = EMBED_URL_PATTERN.exec(video.embedURL)
  if (!media || !embed) return null

  const uploadedAt = video.uploadDate ? Date.parse(video.uploadDate) : NaN
  return {
    videoId: embed[1],
    cdnHost: media[1],
    mediaId: media[2],
    title: decodeHtmlEntities(video.description?.trim() || video.name?.trim() || 'Untitled clip'),
    durationSeconds: parseIsoDuration(video.duration),
    uploadedAt: Number.isNaN(uploadedAt) ? undefined : uploadedAt,
  }
}

export function parseIsoDuration(duration: string | undefined): number | undefined {
  const match = duration ? ISO_DURATION_PATTERN.exec(duration) : null
  if (!match) return undefined
  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

function readMeta(html: string, property: string): string | null {
  const pattern = new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`, 'i')
  return pattern.exec(html)?.[1] ?? null
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity
    const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    return Number.isFinite(value) ? String.fromCodePoint(value) : entity
  })
}

function absoluteUrl(url: string) {
  return url.startsWith('//') ? `https:${url}` : url
}
