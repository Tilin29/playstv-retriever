// Vercel Routing Middleware. Link previews (Discord, Slack, iMessage, …) read the page's
// HTML without running any JavaScript, so a shared clip link (any page with ?clip=<id>)
// gets its own preview tags here: the clip's thumbnail, title and game, and who posted it.
// Anything unexpected falls through to the site's normal page and preview.

export const config = {
  matcher: ['/u/:path*', '/feed', '/lookup'],
}

const CONVEX_TIMEOUT_MS = 2500
const SITE_NAME = 'PlaysTV Retriever'

type ShareInfo = {
  /** Null when an admin hid it. */
  title: string | null
  gameName: string | null
  username: string
  uploadedAt: number | null
  thumbnailUrl: string | null
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url)
  const clipId = url.searchParams.get('clip')
  if (!clipId) return undefined

  try {
    // The built page; the matcher doesn't cover /index.html, so this doesn't loop.
    const page = await fetch(new URL('/index.html', url))
    if (!page.ok) return undefined
    const html = await page.text()
    const convexUrl = /<meta name="convex-url" content="(https:[^"]+)"/.exec(html)?.[1]
    if (!convexUrl) return undefined

    const info = await getShareInfo(convexUrl, clipId)
    if (!info) return undefined
    return new Response(withClipPreview(html, info, url), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch {
    return undefined
  }
}

/** Calls the `clips:getShareInfo` query over Convex's HTTP API. */
async function getShareInfo(convexUrl: string, clipId: string): Promise<ShareInfo | null> {
  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'clips:getShareInfo', args: { clipId }, format: 'json' }),
    signal: AbortSignal.timeout(CONVEX_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const result = (await response.json()) as { status: string; value?: ShareInfo | null }
  return result.status === 'success' ? (result.value ?? null) : null
}

/** The page with its preview tags describing the clip. */
function withClipPreview(html: string, info: ShareInfo, pageUrl: URL) {
  // "<title> · <game>". A hidden title is left out entirely.
  const name = info.title ?? (info.gameName ? `${info.gameName} clip` : 'Plays.tv clip')
  const title = info.title && info.gameName ? `${info.title} · ${info.gameName}` : name
  const posted = info.uploadedAt
    ? ` on ${new Date(info.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
  const description =
    `Posted by ${info.username}${posted}. This Plays.tv clip was retrieved from the ` +
    `Wayback Machine with ${SITE_NAME}.`
  const imageAlt = `Thumbnail of a Plays.tv clip by ${info.username}`

  let result = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(`${title} · ${SITE_NAME}`)}</title>`)
    // The site image's size doesn't apply to a clip thumbnail.
    .replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/g, '')
  const tags: [attribute: 'name' | 'property', key: string, value: string | null][] = [
    ['name', 'description', description],
    ['property', 'og:type', 'video.other'],
    ['property', 'og:url', pageUrl.href],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:image', info.thumbnailUrl],
    ['property', 'og:image:alt', imageAlt],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', info.thumbnailUrl],
    ['name', 'twitter:image:alt', imageAlt],
  ]
  for (const [attribute, key, value] of tags) {
    // Without a thumbnail, the site image stays.
    if (value === null) continue
    const tag = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`)
    result = result.replace(tag, `$1${escapeHtml(value)}$2`)
  }
  return result
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
