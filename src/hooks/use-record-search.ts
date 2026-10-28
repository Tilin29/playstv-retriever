import { useMutation } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { api } from '@convex/_generated/api'

type SearchKind = FunctionArgs<typeof api.searches.record>['kind']

/**
 * Logs a submitted search for the admin panel. Fire-and-forget: a search runs the same
 * whether or not it was logged.
 */
export function useRecordSearch() {
  const record = useMutation(api.searches.record)
  return (kind: SearchKind, terms: string[]) => {
    record({ kind, terms }).catch(() => {})
  }
}
