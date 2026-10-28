import { Link } from '@tanstack/react-router'
import { CheckIcon, LinkIcon, SearchIcon, UserIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { SEARCHES_PAGE_SIZE, useSearches, type Search } from '../hooks/use-moderation'
import { formatDateTime } from '../lib/format'

type Outcome = 'match' | 'no_match' | 'searching' | 'error'

const OUTCOME_LABELS: Record<Outcome, string> = {
  match: 'Match',
  no_match: 'No match',
  searching: 'Searching…',
  error: "Archive didn't respond",
}

/** What visitors searched for, newest first, and whether each search found anything. */
export function SearchLog({ sessionToken }: { sessionToken: string }) {
  const { results, status, loadMore } = useSearches(sessionToken)

  if (status === 'LoadingFirstPage') return <Skeleton className="h-48" />

  if (results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>No searches yet</EmptyTitle>
          <EmptyDescription>Usernames and clip links visitors look up show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {results.map((search) => (
          <li key={search._id} className="flex flex-col gap-2 px-4 py-3 text-sm">
            {search.kind === 'username' ? (
              <UsernameSearch search={search} />
            ) : (
              <LinksSearch search={search} />
            )}
          </li>
        ))}
      </ul>
      {status === 'LoadingMore' && <Spinner className="self-center" />}
      {status === 'CanLoadMore' && (
        <Button variant="outline" className="self-center" onClick={() => loadMore(SEARCHES_PAGE_SIZE)}>
          Load more
        </Button>
      )}
    </div>
  )
}

function UsernameSearch({ search }: { search: Extract<Search, { kind: 'username' }> }) {
  const outcome: Outcome =
    search.status === 'ready'
      ? 'match'
      : search.status === 'not_found'
        ? 'no_match'
        : search.status === 'error'
          ? 'error'
          : 'searching'
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <UserIcon className="size-4 shrink-0 text-muted-foreground" />
        {search.usernameKey && outcome === 'match' ? (
          <Link
            to="/u/$username"
            params={{ username: search.usernameKey }}
            className="font-medium break-all hover:underline"
          >
            {search.username}
          </Link>
        ) : (
          <span className="font-medium break-all">{search.username}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {outcome === 'match' && search.recoveredCount !== null && search.clipCount !== null && (
          <span className="text-muted-foreground">
            {search.recoveredCount} of {search.clipCount} clips recovered
          </span>
        )}
        <OutcomeBadge outcome={outcome} />
        <time className="text-xs text-muted-foreground tabular-nums">
          {formatDateTime(search.searchedAt)}
        </time>
      </div>
    </div>
  )
}

function LinksSearch({ search }: { search: Extract<Search, { kind: 'links' }> }) {
  const found = search.links.filter((link) => link.status === 'found').length
  const searching = search.links.some((link) => link.status === 'searching')
  const outcome: Outcome = found > 0 ? 'match' : searching ? 'searching' : 'no_match'
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">
            {search.links.length} clip {search.links.length === 1 ? 'link' : 'links'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            {found} of {search.links.length} found
          </span>
          <OutcomeBadge outcome={outcome} />
          <time className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(search.searchedAt)}
          </time>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 pl-6 font-mono text-xs">
        {search.links.map((link) => (
          <li
            key={link.key}
            className={cn(
              'flex items-center gap-1.5 break-all',
              link.status === 'found' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {link.status === 'found' ? (
              <CheckIcon className="size-3 shrink-0" />
            ) : link.status === 'searching' ? (
              <Spinner className="size-3 shrink-0" />
            ) : (
              <XIcon className="size-3 shrink-0" />
            )}
            {link.key.startsWith('s:') ? `plays.tv/s/${link.key.slice(2)}` : `plays.tv/video/${link.key}`}
          </li>
        ))}
      </ul>
    </>
  )
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge
      variant={outcome === 'match' ? 'default' : outcome === 'no_match' ? 'destructive' : 'secondary'}
    >
      {OUTCOME_LABELS[outcome]}
    </Badge>
  )
}
