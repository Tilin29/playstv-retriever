import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

export type ReportedClip = NonNullable<FunctionReturnType<typeof api.admin.listReports>>[number]
export type BlacklistedClip = NonNullable<
  FunctionReturnType<typeof api.admin.listBlacklisted>
>[number]

export function useReportedClips(sessionToken: string) {
  return useQuery(api.admin.listReports, { sessionToken })
}

export function useBlacklistedClips(sessionToken: string) {
  return useQuery(api.admin.listBlacklisted, { sessionToken })
}

type ClipAction = 'blacklist' | 'dismiss' | 'restore'

/** Blacklists, dismisses the reports of, or restores one clip at a time. */
export function useClipActions(sessionToken: string) {
  const mutations = {
    blacklist: useMutation(api.admin.blacklistClip),
    dismiss: useMutation(api.admin.dismissReports),
    restore: useMutation(api.admin.restoreClip),
  }
  const [pending, setPending] = useState<{ clipId: Id<'clips'>; action: ClipAction }>()
  const [error, setError] = useState<string>()

  async function run(action: ClipAction, clipId: Id<'clips'>) {
    setPending({ clipId, action })
    setError(undefined)
    try {
      await mutations[action]({ sessionToken, clipId })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : 'Something went wrong')
    } finally {
      setPending(undefined)
    }
  }

  return { run, pending, error }
}
