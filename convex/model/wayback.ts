const WAYBACK_ORIGIN = 'https://web.archive.org'
const USER_AGENT = 'playstv-retriever/0.1 (recovering archived Plays.tv clips)'
const OFFLINE_MARKER = 'Internet Archive: Temporarily Offline'
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000]
// The Archive rarely sends Retry-After with a 429; this is what its maintainers suggest.
const RATE_LIMIT_PAUSE_MS = 60_000
// Once it has blocked an IP for a while, the Archive refuses connections outright.
const REFUSED_PAUSE_MS = 30_000
const RAW_CAPTURE_PATH_PATTERN = /\/web\/(\d{14})id_\/(.+)$/

export type Snapshot = { timestamp: string; url: string }

/** The Archive rate-limits its CDX search much more tightly than replays. */
export type ArchiveEndpoint = 'cdx' | 'replay'

/** Spaces out requests across every running action (see model/archive.ts). */
export type ArchiveGate = {
  /** Resolves once a request to `endpoint` may be sent. */
  wait(endpoint: ArchiveEndpoint): Promise<void>
  /** Holds off every request for `ms`. */
  pause(ms: number): Promise<void>
}

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

/**
 * Returns null for 404s and passes redirects through; throws RetryableError for
 * rate limits, refused connections and outages.
 */
async function get(
  gate: ArchiveGate,
  endpoint: ArchiveEndpoint,
  url: string,
  init?: RequestInit,
): Promise<Response | null> {
  await gate.wait(endpoint)
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT } })
  } catch (error) {
    await gate.pause(REFUSED_PAUSE_MS)
    throw new RetryableError(
      `Could not reach the Wayback Machine: ${error instanceof Error ? error.message : error}`,
    )
  }
  if (response.status === 404) return null
  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    await gate.pause(retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : RATE_LIMIT_PAUSE_MS)
  }
  if (response.status === 429 || response.status >= 500) {
    throw new RetryableError(`Wayback Machine responded with ${response.status}`)
  }
  if (!response.ok && !isRedirect(response)) {
    throw new Error(`Wayback Machine responded with ${response.status}`)
  }
  return response
}

function isRedirect(response: Response) {
  return response.status >= 300 && response.status < 400
}

// The Archive serves its outage page with a 200 status, so check the body too.
function assertOnline(body: string) {
  if (body.includes(OFFLINE_MARKER)) {
    throw new RetryableError('The Internet Archive is temporarily offline')
  }
}

async function getText(gate: ArchiveGate, endpoint: ArchiveEndpoint, url: string) {
  return withRetries(async () => {
    const response = await get(gate, endpoint, url)
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

function parseRawCaptureUrl(url: string): Snapshot | null {
  const match = RAW_CAPTURE_PATH_PATTERN.exec(url)
  return match ? { timestamp: match[1], url: match[2] } : null
}

/**
 * Lists successful captures of URLs starting with `urlPrefix` (one per distinct URL).
 * `originalPattern` narrows them server-side to URLs fully matching that regex.
 */
export async function listCaptures(
  gate: ArchiveGate,
  urlPrefix: string,
  originalPattern?: string,
): Promise<Snapshot[]> {
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
  const body = await getText(gate, 'cdx', `${WAYBACK_ORIGIN}/cdx/search/cdx?${params}`)
  if (!body?.trim()) return []
  const rows = JSON.parse(body) as string[][]
  // The first row is the header.
  return rows.slice(1).map(([timestamp, url]) => ({ timestamp, url }))
}

/**
 * Finds the capture of a file closest to `timestamp` without downloading it. Much
 * faster than a CDX search (about 1s instead of 10-40s) and under a looser rate limit.
 * Returns null when the file was never archived.
 */
export async function findCapture(
  gate: ArchiveGate,
  timestamp: string,
  originalUrl: string,
): Promise<Snapshot | null> {
  return withRetries(async () => {
    const response = await get(gate, 'replay', rawCaptureUrl(timestamp, originalUrl), {
      method: 'HEAD',
      redirect: 'manual',
    })
    if (!response) return null
    // The Archive redirects to the closest capture, unless `timestamp` is an exact match.
    if (isRedirect(response)) {
      const location = response.headers.get('location')
      return location ? parseRawCaptureUrl(new URL(location, WAYBACK_ORIGIN).href) : null
    }
    if (response.headers.get('content-type')?.includes('text/html')) return null
    return parseRawCaptureUrl(response.url) ?? { timestamp, url: originalUrl }
  })
}

export async function fetchCaptureHtml(
  gate: ArchiveGate,
  snapshot: Snapshot,
): Promise<string | null> {
  return getText(gate, 'replay', rawCaptureUrl(snapshot.timestamp, snapshot.url))
}

/**
 * Downloads an archived file (image/video). The Wayback Machine redirects to the
 * capture closest to `timestamp`. Returns null when the file was never archived.
 */
export async function fetchArchivedFile(
  gate: ArchiveGate,
  timestamp: string,
  originalUrl: string,
): Promise<Blob | null> {
  return withRetries(async () => {
    const response = await get(gate, 'replay', rawCaptureUrl(timestamp, originalUrl))
    if (!response) return null
    if (response.headers.get('content-type')?.includes('text/html')) {
      assertOnline(await response.text())
      return null
    }
    return await response.blob()
  })
}
