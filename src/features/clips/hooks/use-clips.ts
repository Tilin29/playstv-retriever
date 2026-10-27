import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

export type Clip = FunctionReturnType<typeof api.clips.listByProfile>[number]

export function useClips(profileId: Id<'profiles'> | undefined) {
  return useQuery(api.clips.listByProfile, profileId ? { profileId } : 'skip')
}
