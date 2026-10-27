import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

export function useVideos() {
  return useQuery(api.videos.list)
}

export function useAddVideo() {
  return useMutation(api.videos.add)
}
