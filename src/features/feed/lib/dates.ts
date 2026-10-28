const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Whether `value` is a YYYY-MM-DD date, as date inputs and the feed's URL use. */
export function isDateParam(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(dayStart(value))
}

/** The first millisecond of the day (UTC). */
export function dayStart(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`)
}

/** The last millisecond of the day (UTC), so a "to" date includes that whole day. */
export function dayEnd(date: string) {
  return Date.parse(`${date}T23:59:59.999Z`)
}
