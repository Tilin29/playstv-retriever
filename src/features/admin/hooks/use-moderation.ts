import { useState } from 'react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
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

/** A clip's real title and moderation state, for the viewer's admin controls. */
export function useModeratedClip(sessionToken: string, clipId: Id<'clips'>) {
  return useQuery(api.admin.getClip, { sessionToken, clipId })
}

export function useSearches(sessionToken: string) {
  return usePaginatedQuery(
    api.admin.listSearches,
    { sessionToken },
    { initialNumItems: SEARCHES_PAGE_SIZE },
  )
}

export type Search = FunctionReturnType<typeof api.admin.listSearches>['page'][number]
export const SEARCHES_PAGE_SIZE = 25

type ClipAction = 'blacklist' | 'dismiss' | 'restore' | 'hideTitle' | 'showTitle'

/** Blacklists, dismisses the reports of, restores or hides the title of one clip at a time. */
export function useClipActions(sessionToken: string) {
  const blacklist = useMutation(api.admin.blacklistClip)
  const dismiss = useMutation(api.admin.dismissReports)
  const restore = useMutation(api.admin.restoreClip)
  const setTitleHidden = useMutation(api.admin.setTitleHidden)
  const mutations: Record<ClipAction, (args: { sessionToken: string; clipId: Id<'clips'> }) => Promise<null>> = {
    blacklist,
    dismiss,
    restore,
    hideTitle: (args) => setTitleHidden({ ...args, hidden: true }),
    showTitle: (args) => setTitleHidden({ ...args, hidden: false }),
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
