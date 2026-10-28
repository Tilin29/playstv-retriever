import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'

export type RecentProfile = FunctionReturnType<typeof api.profiles.listRecent>[number]

export function useRecentProfiles() {
  return useQuery(api.profiles.listRecent, {})
}
