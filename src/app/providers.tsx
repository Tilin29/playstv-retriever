import type { ReactNode } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { env } from '@/lib/env'

const convex = new ConvexReactClient(env.convexUrl)

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
