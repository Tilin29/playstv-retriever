const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(timestamp: number) {
  return dateTimeFormat.format(timestamp)
}
