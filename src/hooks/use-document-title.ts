import { useEffect } from 'react'

export const APP_NAME = 'PlaysTV Retriever'

// Matches the <title> in index.html, which search engines see.
const DEFAULT_TITLE = `${APP_NAME} – Find and recover your lost Plays.tv clips`

/** Sets the browser tab title to "<title> · PlaysTV Retriever" while the component is mounted. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${APP_NAME}`
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
