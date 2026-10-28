// Parsing for archived Plays.tv pages. Pure functions: no Convex or network access.

export type ParsedClip = {
  videoId: string
  mediaId: string
  cdnHost: string
  title: string
  durationSeconds?: number
  uploadedAt?: number
  /** Plays.tv's id for the game; only the HTML clip list has it. */
  gameId?: string
  gameName?: string
}

export type ParsedProfilePage = {
  displayName: string | null
  avatarUrl: string | null
  clips: ParsedClip[]
  /** Config for fetching the next batch of clips ("load more"), if the page had one. */
  nextVideosPage: VideosModuleConfig | null
}

/** The UserVideosMod config Plays.tv sent to /ws/module to load more clips. */
export type VideosModuleConfig = Record<string, string>

export type ParsedVideosModulePage = {
  clips: ParsedClip[]
  nextVideosPage: VideosModuleConfig | null
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

export function clipMediaUrl(
  clip: { cdnHost: string; mediaId: string },
  file: 'preview_144.mp4' | '480.jpg' | '144.jpg',
) {
  return `https://${clip.cdnHost}/video/${clip.mediaId}/processed/${file}`
}

/** Archive lookups ask for the capture closest to Plays.tv's shutdown. */
export const PLAYSTV_SHUTDOWN_TIMESTAMP = '20191215'

/** Full-length MP4 qualities Plays.tv encoded, best first. */
export const FULL_VIDEO_QUALITIES = [1080, 720, 480] as const

export function clipVideoUrl(cdnHost: string, mediaId: string, quality: number) {
  return `https://${cdnHost}/video/${mediaId}/processed/${quality}.mp4`
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

  // The HTML list can hold clips the JSON-LD block left out, and it alone names the game.
  for (const clip of parseVideoListItems(html)) {
    const existing = clips.get(clip.videoId)
    if (!existing) clips.set(clip.videoId, clip)
    else if (clip.gameId && !existing.gameId) {
      clips.set(clip.videoId, { ...existing, gameId: clip.gameId, gameName: clip.gameName })
    }
  }

  const ogTitle = readMeta(html, 'og:title')
  const displayName = ogTitle?.replace(/^Plays\.tv\s*-\s*/i, '').trim() || null
  const ogImage = readMeta(html, 'og:image')
  const avatarUrl = ogImage ? absoluteUrl(ogImage) : null

  return {
    displayName,
    avatarUrl,
    clips: [...clips.values()],
    nextVideosPage: parseVideosModuleConfig(html),
  }
}

const VIDEOS_MODULE_CONF_PATTERN = /data-module-id="UserVideosMod"[^>]*?data-conf='([^']*)'/

function parseVideosModuleConfig(html: string): VideosModuleConfig | null {
  const json = VIDEOS_MODULE_CONF_PATTERN.exec(html)?.[1]
  if (!json) return null
  try {
    return toVideosModuleConfig(JSON.parse(decodeHtmlEntities(json)))
  } catch {
    return null
  }
}

function toVideosModuleConfig(config: unknown): VideosModuleConfig | null {
  if (!config || typeof config !== 'object') return null
  const entries = Object.entries(config).map(([key, value]) => [key, String(value)])
  const result = Object.fromEntries(entries) as VideosModuleConfig
  return result.target_user_id && result.last_id ? result : null
}

/** The /ws/module URL Plays.tv requested to load the clips after `config.last_id`. */
export function videosModuleUrl(config: VideosModuleConfig) {
  const params = new URLSearchParams({ ...config, format: 'application/json', id: 'UserVideosMod' })
  return `https://plays.tv/ws/module?${params}`
}

/** Parses a "load more" response: a JSON envelope whose `body` is the clip list HTML. */
export function parseVideosModulePage(json: string): ParsedVideosModulePage {
  let data: { body?: unknown; config?: unknown }
  try {
    data = JSON.parse(json)
  } catch {
    return { clips: [], nextVideosPage: null }
  }
  const clips = typeof data.body === 'string' ? parseVideoListItems(data.body) : []
  return {
    clips,
    nextVideosPage: clips.length > 0 ? toVideosModuleConfig(data.config) : null,
  }
}

const VIDEO_ITEM_PATTERN = /<li class="video-item" data-feed-id="([A-Za-z0-9]+)">([\s\S]*?)<\/li>/g
const ITEM_MEDIA_PATTERN = /<source src="(\/\/[^/"]+\/video\/[^/"]+\/processed\/)/
const ITEM_THUMBNAIL_PATTERN = /data-lazyload="(\/\/[^/"]+\/video\/[^/"]+\/processed\/)/
const ITEM_TITLE_PATTERN = /class="title">([^<]*)</
const ITEM_DURATION_PATTERN = /class="duration[^"]*">([\d:]+)</
const ITEM_CREATED_PATTERN = /class="created">([^<]+)</
const ITEM_GAME_PATTERN = /<a class="hashtag[^"]*" href="\/game\/[^"?]*\?game_id=([0-9a-f]+)[^"]*">([^<]+)</

/** Parses the `<li class="video-item">` entries of a Plays.tv clip list. */
function parseVideoListItems(html: string): ParsedClip[] {
  const clips: ParsedClip[] = []
  for (const [, videoId, item] of html.matchAll(VIDEO_ITEM_PATTERN)) {
    const mediaPath = ITEM_MEDIA_PATTERN.exec(item)?.[1] ?? ITEM_THUMBNAIL_PATTERN.exec(item)?.[1]
    const media = mediaPath ? MEDIA_URL_PATTERN.exec(mediaPath) : null
    if (!media) continue

    const created = ITEM_CREATED_PATTERN.exec(item)?.[1]
    const uploadedAt = created ? Date.parse(created) : NaN
    const game = ITEM_GAME_PATTERN.exec(item)
    clips.push({
      videoId,
      cdnHost: media[1],
      mediaId: media[2],
      title: decodeHtmlEntities(ITEM_TITLE_PATTERN.exec(item)?.[1]?.trim() || 'Untitled clip'),
      durationSeconds: parseClockDuration(ITEM_DURATION_PATTERN.exec(item)?.[1]),
      uploadedAt: Number.isNaN(uploadedAt) ? undefined : uploadedAt,
      gameId: game?.[1],
      gameName: game ? decodeHtmlEntities(game[2].trim()) : undefined,
    })
  }
  return clips
}

/** A clip's page id in a pasted link: plays.tv/video/<id>/<slug> or plays.tv/embeds/<id>. */
export const CLIP_LINK_PATTERN = /plays\.tv\/(?:video|embeds)\/([A-Za-z0-9]{6,32})/i
export const CLIP_VIDEO_ID_PATTERN = /^[A-Za-z0-9]{6,32}$/
/** A share link, plays.tv/s/<code>, which redirected to the clip's page. */
export const SHORT_LINK_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/

export function shortLinkUrl(code: string) {
  return `plays.tv/s/${code}`
}

/** Archived URLs that show a single clip, best first. */
export function clipPageUrls(videoId: string) {
  return [`https://plays.tv/embeds/${videoId}`, `https://plays.tv/video/${videoId}`]
}

export type ParsedClipPage = { clip: ParsedClip; ownerUsername: string }

// Clip pages came in two layouts: the 2019 embed page (/embeds/<id>) and the older video
// page (/video/<id>), which keeps most of its markup in escaped script strings. Video
// pages also list related clips, so only markup that belongs to the clip itself is read.
const PAGE_MEDIA_PATTERN = /(\/\/[^/"'\s]+\/video\/[^/"'\s]+\/processed\/)/
const PAGE_OG_IMAGE_PATTERN = /property="og:image" content="([^"]*\/video\/[^"/]+\/processed\/)/
const PAGE_OWNER_PATTERNS = [
  /class="video-author"><a href="\/u\/([^"/?#]+)/,
  /"original_author_urlname":"([^"]+)"/,
  /property="og:description" content="Posted by ([^"]+)"/,
]
const PAGE_TITLE_PATTERN = /class="video-title"><a [^>]*>([^<]*)</
const PAGE_OG_TITLE_PATTERN = /property="og:title" content="Watch [^"']+'s .*? video: ([^"]*) - Plays\.tv"/
const PAGE_DOCUMENT_TITLE_PATTERN = /<title>([^<]*)<\/title>/
const PAGE_GAME_PATTERNS = [
  /class="game-link" href="\/game\/[^"?]*\?game_id=([0-9a-f]+)[^"]*">([^<]+)</,
  /<span class="in">in<\/span> <a href="[^"]*?game_id=([0-9a-f]+)[^"]*"[^>]*>([^<]+)</,
]
const PAGE_DURATION_PATTERN = /class="duration"[^>]*>([\d:]+)</
const PAGE_POSTED_PATTERN = /<div class="post"><span class="time">([^<]+)</

/**
 * Reads one clip from its archived embed or video page: the media files, title, game,
 * length and who uploaded it. Null when the page doesn't show this clip.
 */
export function parseClipPage(rawHtml: string, videoId: string): ParsedClipPage | null {
  // Unescapes the script strings, so both layouts read the same.
  const html = rawHtml.replaceAll('\\/', '/').replaceAll('\\"', '"')
  if (!html.includes(videoId)) return null
  const mediaPath = PAGE_OG_IMAGE_PATTERN.exec(html)?.[1] ?? PAGE_MEDIA_PATTERN.exec(html)?.[1]
  const media = mediaPath ? MEDIA_URL_PATTERN.exec(mediaPath) : null
  const owner = firstMatch(html, PAGE_OWNER_PATTERNS)?.[1]
  if (!media || !owner) return null
  const ownerUsername = decodeURIComponent(owner)

  const documentTitle = PAGE_DOCUMENT_TITLE_PATTERN.exec(html)?.[1]
    ?.replace(/ - Plays\.tv$/, '')
    .replace(`${ownerUsername} - `, '')
  const title =
    PAGE_TITLE_PATTERN.exec(html)?.[1]?.trim() ||
    PAGE_OG_TITLE_PATTERN.exec(html)?.[1]?.trim() ||
    documentTitle?.trim()
  const game = firstMatch(html, PAGE_GAME_PATTERNS)
  // The player's ad data carries the length of the clip itself, in seconds.
  const length = new RegExp(`data-feed-id="${videoId}"\\s+data-ad="[^"]*?length%3D([\\d.]+)`).exec(
    html,
  )?.[1]
  const posted = PAGE_POSTED_PATTERN.exec(html)?.[1]
  const uploadedAt = posted ? Date.parse(posted) : NaN
  return {
    ownerUsername,
    clip: {
      videoId,
      cdnHost: media[1],
      mediaId: media[2],
      title: decodeHtmlEntities(title || 'Untitled clip'),
      durationSeconds: length
        ? Math.round(Number(length))
        : parseClockDuration(PAGE_DURATION_PATTERN.exec(html)?.[1]),
      uploadedAt: Number.isNaN(uploadedAt) ? undefined : uploadedAt,
      gameId: game?.[1],
      gameName: game ? decodeHtmlEntities(game[2].trim()) : undefined,
    },
  }
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) return match
  }
  return null
}

/** Parses "1:02:03" / "4:05" style durations into seconds. */
function parseClockDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined
  return duration.split(':').reduce((total, part) => total * 60 + Number(part), 0)
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
