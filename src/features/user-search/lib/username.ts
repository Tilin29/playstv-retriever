const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/
const PROFILE_URL_PATTERN = /plays\.tv\/u\/([^/?#\s]+)/i

export type ParsedUsername = { ok: true; username: string } | { ok: false; error: string }

/**
 * Accepts a bare username, "@username", or a pasted plays.tv profile URL
 * (e.g. https://plays.tv/u/someone) and returns the username.
 */
export function parseUsername(input: string): ParsedUsername {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Enter a Plays.tv username.' }

  const fromUrl = PROFILE_URL_PATTERN.exec(trimmed)?.[1]
  const username = (fromUrl ? decodeURIComponent(fromUrl) : trimmed).replace(/^@/, '')

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: 'Usernames can only contain letters, numbers, dots, dashes and underscores.',
    }
  }
  return { ok: true, username }
}
