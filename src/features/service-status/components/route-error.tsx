import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { useServiceUnavailable } from '../hooks/use-service-unavailable'
import { LimitsReachedNotice } from './limits-reached-notice'

/** A page's error screen. A failing query usually means the backend is over its limits. */
export function RouteError(_props: ErrorComponentProps) {
  const unavailable = useServiceUnavailable()
  if (unavailable) return <LimitsReachedNotice />
  return (
    <div className="space-y-2">
      <p className="font-medium">Something went wrong loading this page.</p>
      <Link to="/" reloadDocument className="text-sm text-muted-foreground underline underline-offset-4">
        Back to home
      </Link>
    </div>
  )
}
