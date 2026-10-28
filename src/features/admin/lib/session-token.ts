// The admin session token, kept in localStorage so a sign-in survives reloads and is
// shared by every component (and tab) that needs it.
const STORAGE_KEY = 'admin-session'

const listeners = new Set<() => void>()
// Used when storage is blocked, so signing in still works until the page is closed.
let memoryToken: string | null = null

export function getSessionToken() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return memoryToken
  }
}

export function setSessionToken(token: string | null) {
  memoryToken = token
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is blocked; `memoryToken` holds it instead.
  }
  for (const listener of listeners) listener()
}

export function subscribeToSessionToken(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
