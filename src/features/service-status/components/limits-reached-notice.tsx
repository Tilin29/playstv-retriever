import { CalendarClockIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { APP_NAME, useDocumentTitle } from '@/hooks/use-document-title'

/** Convex's monthly limits reset at the start of each calendar month (UTC). */
function nextReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/** Shown in place of every page while the backend is over its monthly usage limits. */
export function LimitsReachedNotice() {
  useDocumentTitle('Temporarily unavailable')
  const reset = nextReset().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <Empty className="mx-auto max-w-xl py-16">
      <EmptyHeader className="max-w-xl">
        <EmptyMedia variant="icon">
          <CalendarClockIcon />
        </EmptyMedia>
        <EmptyTitle className="text-xl font-semibold tracking-tight">
          {APP_NAME} is taking a break until next month
        </EmptyTitle>
        <EmptyDescription className="flex flex-col gap-3">
          <p>
            {APP_NAME} is a free service, and we want it to stay that way: no ads, no
            subscriptions, no paywalls. To keep it free, it runs on a hosting plan with a fixed
            monthly allowance, and so many people have been recovering their clips this month
            that we've used all of it.
          </p>
          <p>
            Until the allowance resets, the website can't search profiles or load clips. It
            should come back on its own on <strong>{reset}</strong>. Your clips are still safe in
            the Wayback Machine, so nothing is lost while we wait.
          </p>
          <p>Thanks for your patience, and see you next month!</p>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
