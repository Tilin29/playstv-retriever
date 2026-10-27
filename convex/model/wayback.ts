const WAYBACK_ORIGIN = 'https://web.archive.org'
const USER_AGENT = 'playstv-retriever/0.1 (recovering archived Plays.tv clips)'
const OFFLINE_MARKER = 'Internet Archive: Temporarily Offline'
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000]

export type Snapshot = { timestamp: string; url: string }

class RetryableError extends Error {}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= RETRY_DELAYS_MS.length) throw error
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}

// When the Archive rate-limits one request, every request in this action holds off
// until then, so parallel workers don't keep hammering it.
let backoffUntil = 0

async function waitForBackoff() {
  for (let wait = backoffUntil - Date.now(); wait > 0; wait = backoffUntil - Date.now()) {
    await sleep(wait)
  }
}

function backOff(response: Response) {
  const retryAfterSeconds = Number(response.headers.get('retry-after'))
  const delay = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : RETRY_DELAYS_MS[0]
  backoffUntil = Math.max(backoffUntil, Date.now() + delay)
}

/** Returns null for 404s; throws RetryableError for rate limits and outages. */
async function get(url: string): Promise<Response | null> {
  await waitForBackoff()
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (response.status === 404) return null
  if (response.status === 429) backOff(response)
  if (response.status === 429 || response.status >= 500) {
    throw new RetryableError(`Wayback Machine responded with ${response.status}`)
  }
  if (!response.ok) throw new Error(`Wayback Machine responded with ${response.status}`)
  return response
}

// The Archive serves its outage page with a 200 status, so check the body too.
function assertOnline(body: string) {
  if (body.includes(OFFLINE_MARKER)) {
    throw new RetryableError('The Internet Archive is temporarily offline')
  }
}

async function getText(url: string): Promise<string | null> {
  return withRetries(async () => {
    const response = await get(url)
    if (!response) return null
    const body = await response.text()
    assertOnline(body)
    return body
  })
}

/** URL of the original, unmodified capture (no Wayback toolbar or link rewriting). */
export function rawCaptureUrl(timestamp: string, originalUrl: string) {
  return `${WAYBACK_ORIGIN}/web/${timestamp}id_/${originalUrl}`
}

/** URL for viewing a capture in the Wayback Machine UI. */
export function captureUrl(timestamp: string, originalUrl: string) {
  return `${WAYBACK_ORIGIN}/web/${timestamp}/${originalUrl}`
}

/**
 * Lists successful captures of URLs starting with `urlPrefix` (one per distinct URL).
 * `originalPattern` narrows them server-side to URLs fully matching that regex.
 */
export async function listCaptures(urlPrefix: string, originalPattern?: string): Promise<Snapshot[]> {
  const params = new URLSearchParams({
    url: urlPrefix,
    matchType: 'prefix',
    output: 'json',
    fl: 'timestamp,original',
    filter: 'statuscode:200',
    collapse: 'urlkey',
    limit: '1000',
  })
  if (originalPattern) params.append('filter', `original:${originalPattern}`)
  const body = await getText(`${WAYBACK_ORIGIN}/cdx/search/cdx?${params}`)
  if (!body?.trim()) return []
  const rows = JSON.parse(body) as string[][]
  // The first row is the header.
  return rows.slice(1).map(([timestamp, url]) => ({ timestamp, url }))
}

export async function fetchCaptureHtml(snapshot: Snapshot): Promise<string | null> {
  return getText(rawCaptureUrl(snapshot.timestamp, snapshot.url))
}

/**
 * Downloads an archived file (image/video). The Wayback Machine redirects to the
 * capture closest to `timestamp`. Returns null when the file was never archived.
 */
export async function fetchArchivedFile(timestamp: string, originalUrl: string): Promise<Blob | null> {
  return withRetries(async () => {
    const response = await get(rawCaptureUrl(timestamp, originalUrl))
    if (!response) return null
    if (response.headers.get('content-type')?.includes('text/html')) {
      assertOnline(await response.text())
      return null
    }
    return await response.blob()
  })
}
