const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

/** Formats a Wayback timestamp (YYYYMMDDhhmmss, UTC) as a date. */
export function formatSnapshotDate(timestamp: string) {
  const [year, month, day] = [timestamp.slice(0, 4), timestamp.slice(4, 6), timestamp.slice(6, 8)]
  return dateFormatter.format(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}
