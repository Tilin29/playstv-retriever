const fullFormatter = new Intl.NumberFormat('en-US')
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** e.g. "1,934", or "128.4K" from 100,000 up. */
export function formatCount(count: number) {
  return count >= 100_000 ? compactFormatter.format(count) : fullFormatter.format(count)
}

/** e.g. "64%". Rounds down, like the profile rings. */
export function formatShare(part: number, whole: number) {
  if (whole === 0) return '0%'
  const percent = Math.floor((part / whole) * 100)
  return part > 0 && percent === 0 ? '<1%' : `${percent}%`
}

export function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`
}
