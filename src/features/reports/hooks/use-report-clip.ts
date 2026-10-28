import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { ReportReason } from '../lib/reasons'

/** Files a report about a clip for an admin to review. */
export function useReportClip(clipId: Id<'clips'>) {
  const createReport = useMutation(api.reports.create)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  /** Resolves to whether the report was sent. */
  async function report(reason: ReportReason, details: string) {
    setPending(true)
    setError(undefined)
    try {
      await createReport({ clipId, reason, details: details.trim() || undefined })
      return true
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : "Couldn't send the report")
      return false
    } finally {
      setPending(false)
    }
  }

  return { report, pending, error }
}
