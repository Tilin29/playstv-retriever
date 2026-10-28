import type { ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { RecoveredRing } from '@/features/clips'
import { cn } from '@/lib/utils'
import {
  useCountUp,
  useHasMounted,
  useSiteStats,
  type SiteStats,
} from '../hooks/use-site-stats'
import { formatCount, formatShare, plural } from '../lib/format'

/**
 * The home page's "archive so far": how many full videos were recovered out of the clips
 * found, how many searched usernames had an archived profile, when the clips were
 * recorded, and the games with the most recovered clips. Nothing until the first recount.
 */
export function ArchiveStats() {
  const stats = useSiteStats()
  if (stats === null || stats?.clipsFound === 0) return null

  return (
    <section className="flex w-full flex-col gap-3 text-left" aria-labelledby="archive-stats">
      <h2 id="archive-stats" className="text-sm font-medium text-muted-foreground">
        The archive so far
      </h2>
      {stats === undefined ? <Skeleton className="h-96 rounded-lg" /> : <Stats stats={stats} />}
    </section>
  )
}

function Stats({ stats }: { stats: SiteStats }) {
  return (
    <div className="flex flex-col gap-3">
      <Headline stats={stats} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfilesFound found={stats.profilesFound} searched={stats.usernamesSearched} />
        <ClipsPerProfile clips={stats.clipsFound} profiles={stats.profilesFound} />
      </div>
      {stats.byYear.length > 0 && <ByYear years={stats.byYear} />}
      {stats.topGames.length > 0 && <TopGames games={stats.topGames} />}
    </div>
  )
}

function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border p-4', className)} {...props} />
}

function Headline({ stats }: { stats: SiteStats }) {
  const recovered = useCountUp(stats.clipsRecovered)
  return (
    <Panel className="flex items-center gap-4">
      <RecoveredRing
        recovered={stats.clipsRecovered}
        total={stats.clipsFound}
        className="size-24 text-xl"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatCount(recovered)}
        </p>
        <p className="text-sm text-muted-foreground">
          full-length videos recovered from the Wayback Machine, out of{' '}
          {plural(stats.clipsFound, 'clip')} found
        </p>
      </div>
    </Panel>
  )
}

/** A label, a number, and a thin meter of `part` out of `whole`. */
function ProfilesFound({ found, searched }: { found: number; searched: number }) {
  const shown = useCountUp(found)
  const mounted = useHasMounted()
  const share = searched > 0 ? found / searched : 0
  return (
    <Panel className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Profiles found</p>
      <p className="text-2xl font-semibold tracking-tight">{formatCount(shown)}</p>
      <div
        role="img"
        aria-label={`${found} of ${searched} searched usernames had an archived profile`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: mounted ? `${share * 100}%` : 0 }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatShare(found, searched)} of {plural(searched, 'searched username')} had an
        archived profile
      </p>
    </Panel>
  )
}

function ClipsPerProfile({ clips, profiles }: { clips: number; profiles: number }) {
  const shown = useCountUp(profiles > 0 ? Math.round(clips / profiles) : 0)
  return (
    <Panel className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Clips per profile</p>
      <p className="text-2xl font-semibold tracking-tight">{formatCount(shown)}</p>
      <p className="mt-auto text-xs text-muted-foreground">
        On average, with each clip's title, game and upload date
      </p>
    </Panel>
  )
}

const CHART_HEIGHT_PX = 128

/**
 * A column per upload year: its full height is the clips found, the dark part at the
 * bottom the ones with a full video. Hover or focus a column for its numbers.
 */
function ByYear({ years }: { years: SiteStats['byYear'] }) {
  const mounted = useHasMounted()
  const max = Math.max(...years.map((year) => year.found))
  const peak = years.find((year) => year.found === max)!

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">When the clips were uploaded</p>
        <div className="flex gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Full video
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-muted-foreground/30" />
            No full video
          </span>
        </div>
      </div>
      <ul
        className="flex items-end justify-around gap-2 border-b"
        style={{ height: CHART_HEIGHT_PX + 20 }}
      >
        {years.map((year) => {
          const missing = year.found - year.recovered
          const label =
            `${year.year}: ${plural(year.found, 'clip')} found, ` +
            `${formatCount(year.recovered)} with a full video (${formatShare(year.recovered, year.found)})`
          return (
            <li
              key={year.year}
              tabIndex={0}
              aria-label={label}
              className="group relative flex h-full w-full max-w-16 flex-col items-center justify-end outline-none"
            >
              {/* The peak year is labeled; the others show their numbers on hover. */}
              <span
                className={cn(
                  'mb-1 text-xs text-muted-foreground tabular-nums',
                  year !== peak && 'invisible',
                )}
              >
                {formatCount(year.found)}
              </span>
              <div
                className="flex w-6 flex-col justify-end gap-0.5 transition-[height] duration-700 ease-out"
                style={{ height: mounted ? (year.found / max) * CHART_HEIGHT_PX : 0 }}
              >
                {missing > 0 && (
                  <div
                    className="min-h-0.5 rounded-t bg-muted-foreground/30"
                    style={{ flexGrow: missing }}
                  />
                )}
                {year.recovered > 0 && (
                  <div
                    className={cn('min-h-0.5 bg-primary', missing === 0 && 'rounded-t')}
                    style={{ flexGrow: year.recovered }}
                  />
                )}
              </div>
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-48 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
              >
                <p className="font-medium">{year.year}</p>
                <p className="text-muted-foreground">{plural(year.found, 'clip')} found</p>
                <p className="text-muted-foreground">
                  {formatCount(year.recovered)} full videos ·{' '}
                  {formatShare(year.recovered, year.found)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <ul className="-mt-2 flex justify-around gap-2" aria-hidden>
        {years.map((year) => (
          <li
            key={year.year}
            className="w-full max-w-16 text-center text-xs text-muted-foreground tabular-nums"
          >
            {year.year}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** The games with the most recovered clips, each linking to its clips in the feed. */
function TopGames({ games }: { games: SiteStats['topGames'] }) {
  const mounted = useHasMounted()
  const max = games[0]!.recoveredCount
  return (
    <Panel className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Most recovered games</p>
      <ul className="flex flex-col gap-1">
        {games.map((game) => (
          <li key={game.gameId}>
            <Link
              to="/feed"
              search={{ game: game.gameId }}
              className="-mx-2 flex flex-col gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{game.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatCount(game.recoveredCount)}
                </span>
              </span>
              <span className="block h-2" aria-hidden>
                <span
                  className="block h-full rounded-r bg-primary transition-[width] duration-700 ease-out"
                  style={{ width: mounted ? `${(game.recoveredCount / max) * 100}%` : 0 }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
