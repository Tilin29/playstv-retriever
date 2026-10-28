import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

// Read by the inline script in index.html, which applies the theme before the first paint.
const STORAGE_KEY = 'theme'

function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/** The current colour theme. It follows the system until the visitor picks one. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme)

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (e.g. private mode); the choice then lasts for this visit.
    }
  }, [])

  return { theme, setTheme }
}
