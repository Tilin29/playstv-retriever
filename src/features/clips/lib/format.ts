export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** e.g. "28%". Rounds down, so "100%" only appears when every clip was recovered. */
export function formatRecoveredPercent(recovered: number, total: number) {
  if (total === 0) return '0%'
  const percent = Math.floor((recovered / total) * 100)
  return recovered > 0 && percent === 0 ? '<1%' : `${percent}%`
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatDate(timestamp: number) {
  return dateFormatter.format(timestamp)
}
