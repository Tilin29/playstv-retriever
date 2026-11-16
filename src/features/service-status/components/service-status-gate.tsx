import type { ReactNode } from 'react'
import { useServiceUnavailable } from '../hooks/use-service-unavailable'
import { LimitsReachedNotice } from './limits-reached-notice'

/** Renders the limits notice instead of `children` while the backend is unavailable. */
export function ServiceStatusGate({ children }: { children: ReactNode }) {
  return useServiceUnavailable() ? <LimitsReachedNotice /> : children
}
