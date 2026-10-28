// Vercel Routing Middleware. Link previews (Discord, Slack, iMessage, …) read the page's
// HTML without running any JavaScript, so shared links get their own preview tags here:
// a clip link (any page with ?clip=<id>) shows the clip's thumbnail, title and game, and
// who posted it; a profile link (/u/<username>) shows the user's avatar and clip counts.
// Anything unexpected falls through to the site's normal page and preview.

export const config = {
  matcher: ['/u/:path*', '/feed', '/lookup'],
}

const CONVEX_TIMEOUT_MS = 2500
const SITE_NAME = 'PlaysTV Retriever'
const PROFILE_PATH_PATTERN = /^\/u\/([^/]+)\/?$/

type ClipShareInfo = {
  /** Null when an admin hid it. */
  title: string | null
  gameName: string | null
  username: string
  uploadedAt: number | null
  thumbnailUrl: string | null
}

type ProfileShareInfo = {
  username: string
  clipCount: number | null
  recoveredCount: number | null
  avatarUrl: string | null
}

type Preview = {
  title: string
  description: string
  type: string
  /** Null keeps the site image. */
  image: string | null
  imageAlt: string
  /** A small square image (an avatar) rather than a wide one. */
  smallImage?: boolean
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url)
  const clipId = url.searchParams.get('clip')
  const username = clipId ? null : profileUsername(url)
  if (!clipId && !username) return undefined

  try {
    // The built page; the matcher doesn't cover /index.html, so this doesn't loop.
    const page = await fetch(new URL('/index.html', url))
    if (!page.ok) return undefined
    const html = await page.text()
    const convexUrl = /<meta name="convex-url" content="(https:[^"]+)"/.exec(html)?.[1]
    if (!convexUrl) return undefined

    let preview: Preview | null = null
    if (clipId) {
      const info = await runQuery<ClipShareInfo>(convexUrl, 'clips:getShareInfo', { clipId })
      preview = info && clipPreview(info)
    } else if (username) {
      const info = await runQuery<ProfileShareInfo>(convexUrl, 'profiles:getShareInfo', {
        username,
      })
      preview = info && profilePreview(info)
    }
    if (!preview) return undefined
    return new Response(withPreview(html, preview, url), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch {
    return undefined
  }
}

function profileUsername(url: URL) {
  const segment = PROFILE_PATH_PATTERN.exec(url.pathname)?.[1]
  if (!segment) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** Calls a Convex query over Convex's HTTP API. */
async function runQuery<T>(
  convexUrl: string,
  path: string,
  args: Record<string, string>,
): Promise<T | null> {
  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    signal: AbortSignal.timeout(CONVEX_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const result = (await response.json()) as { status: string; value?: T | null }
  return result.status === 'success' ? (result.value ?? null) : null
}

function clipPreview(info: ClipShareInfo): Preview {
  // "<title> · <game>". A hidden title is left out entirely.
  const name = info.title ?? (info.gameName ? `${info.gameName} clip` : 'Plays.tv clip')
  const title = info.title && info.gameName ? `${info.title} · ${info.gameName}` : name
  const posted = info.uploadedAt
    ? ` on ${new Date(info.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
  return {
    title,
    description:
      `Posted by ${info.username}${posted}. This Plays.tv clip was retrieved from the ` +
      `Wayback Machine with ${SITE_NAME}.`,
    type: 'video.other',
    image: info.thumbnailUrl,
    imageAlt: `Thumbnail of a Plays.tv clip by ${info.username}`,
  }
}

function profilePreview(info: ProfileShareInfo): Preview {
  const counts =
    info.clipCount === null
      ? ''
      : info.recoveredCount === null
        ? `${plural(info.clipCount, 'clip')} found. `
        : `${plural(info.clipCount, 'clip')} found, ${info.recoveredCount} with full video. `
  return {
    title: `${info.username}'s Plays.tv clips`,
    description: `${counts}Retrieved from the Wayback Machine with ${SITE_NAME}.`,
    type: 'profile',
    image: info.avatarUrl,
    imageAlt: `${info.username}'s Plays.tv avatar`,
    smallImage: info.avatarUrl !== null,
  }
}

/** The page with its preview tags replaced by `preview`'s. */
function withPreview(html: string, preview: Preview, pageUrl: URL) {
  let result = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(`${preview.title} · ${SITE_NAME}`)}</title>`,
  )
  // The site image's size doesn't apply to another image.
  if (preview.image !== null) {
    result = result.replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/g, '')
  }
  const tags: [attribute: 'name' | 'property', key: string, value: string | null][] = [
    ['name', 'description', preview.description],
    ['property', 'og:type', preview.type],
    ['property', 'og:url', pageUrl.href],
    ['property', 'og:title', preview.title],
    ['property', 'og:description', preview.description],
    ['property', 'og:image', preview.image],
    ['property', 'og:image:alt', preview.image && preview.imageAlt],
    ['name', 'twitter:card', preview.smallImage ? 'summary' : null],
    ['name', 'twitter:title', preview.title],
    ['name', 'twitter:description', preview.description],
    ['name', 'twitter:image', preview.image],
    ['name', 'twitter:image:alt', preview.image && preview.imageAlt],
  ]
  for (const [attribute, key, value] of tags) {
    // A null value keeps the site's tag.
    if (value === null) continue
    const tag = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`)
    result = result.replace(tag, `$1${escapeHtml(value)}$2`)
  }
  return result
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
