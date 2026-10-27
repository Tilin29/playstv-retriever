import { useEffect } from 'react'

export const APP_NAME = 'PlaysTV Retriever'

/** Sets the browser tab title to "<title> · PlaysTV Retriever" while the component is mounted. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${APP_NAME}`
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
