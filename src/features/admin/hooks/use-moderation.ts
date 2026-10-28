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

export type FlaggedTitle = NonNullable<
  FunctionReturnType<typeof api.admin.listTitleFlags>
>[number]
export type TitleScan = NonNullable<FunctionReturnType<typeof api.admin.getTitleScan>>

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

/** Clips whose titles contain an offensive word. `enabled: false` skips the query. */
export function useTitleFlags(
  sessionToken: string,
  status: 'open' | 'resolved',
  enabled = true,
) {
  return useQuery(api.admin.listTitleFlags, enabled ? { sessionToken, status } : 'skip')
}

/** The last scan of every title (null when none ran), and starting a new one. */
export function useTitleScan(sessionToken: string) {
  const scan = useQuery(api.admin.getTitleScan, { sessionToken })
  const startScan = useMutation(api.admin.startTitleScan)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string>()

  async function start() {
    setStarting(true)
    setError(undefined)
    try {
      await startScan({ sessionToken })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : 'Something went wrong')
    } finally {
      setStarting(false)
    }
  }

  return { scan, start, starting, error }
}

export type VideoCheck = NonNullable<
  FunctionReturnType<typeof api.admin.getVideoChecks>
>[number]

/** Clips whose full-video check failed because the Archive didn't respond. */
export function useFailedVideoChecks(sessionToken: string) {
  return useQuery(api.admin.listFailedVideoChecks, { sessionToken })
}

/** The given clips as they stand now, to follow their retries. */
export function useVideoChecks(sessionToken: string, clipIds: Id<'clips'>[]) {
  return useQuery(
    api.admin.getVideoChecks,
    clipIds.length > 0 ? { sessionToken, clipIds } : 'skip',
  )
}

/** Retries every failed check, or one clip's. */
export function useRetryVideoChecks(sessionToken: string) {
  const retryAll = useMutation(api.admin.retryFailedVideoChecks)
  const retryOne = useMutation(api.admin.retryVideoCheck)
  const [pending, setPending] = useState<Id<'clips'> | 'all'>()
  const [error, setError] = useState<string>()

  async function run(target: Id<'clips'> | 'all') {
    setPending(target)
    setError(undefined)
    try {
      if (target === 'all') await retryAll({ sessionToken })
      else await retryOne({ sessionToken, clipId: target })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : 'Something went wrong')
    } finally {
      setPending(undefined)
    }
  }

  return { run, pending, error }
}

export type HiddenProfile = NonNullable<
  FunctionReturnType<typeof api.admin.listHiddenProfiles>
>[number]

export function useHiddenProfiles(sessionToken: string) {
  return useQuery(api.admin.listHiddenProfiles, { sessionToken })
}

/** Hides or shows one profile at a time. */
export function useProfileActions(sessionToken: string) {
  const setProfileHidden = useMutation(api.admin.setProfileHidden)
  const [pending, setPending] = useState<Id<'profiles'>>()
  const [error, setError] = useState<string>()

  async function setHidden(profileId: Id<'profiles'>, hidden: boolean) {
    setPending(profileId)
    setError(undefined)
    try {
      await setProfileHidden({ sessionToken, profileId, hidden })
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : 'Something went wrong')
    } finally {
      setPending(undefined)
    }
  }

  return { setHidden, pending, error }
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

type ClipAction =
  | 'blacklist'
  | 'dismiss'
  | 'restore'
  | 'hideTitle'
  | 'showTitle'
  | 'resolveTitleFlag'
  | 'reopenTitleFlag'

/**
 * Blacklists, dismisses the reports of, restores, hides the title of or resolves the
 * title flag of one clip at a time.
 */
export function useClipActions(sessionToken: string) {
  const blacklist = useMutation(api.admin.blacklistClip)
  const dismiss = useMutation(api.admin.dismissReports)
  const restore = useMutation(api.admin.restoreClip)
  const setTitleHidden = useMutation(api.admin.setTitleHidden)
  const setTitleFlagResolved = useMutation(api.admin.setTitleFlagResolved)
  const mutations: Record<ClipAction, (args: { sessionToken: string; clipId: Id<'clips'> }) => Promise<null>> = {
    blacklist,
    dismiss,
    restore,
    hideTitle: (args) => setTitleHidden({ ...args, hidden: true }),
    showTitle: (args) => setTitleHidden({ ...args, hidden: false }),
    resolveTitleFlag: (args) => setTitleFlagResolved({ ...args, resolved: true }),
    reopenTitleFlag: (args) => setTitleFlagResolved({ ...args, resolved: false }),
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
