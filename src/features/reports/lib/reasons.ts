import type { FunctionArgs } from 'convex/server'
import type { api } from '@convex/_generated/api'

export type ReportReason = FunctionArgs<typeof api.reports.create>['reason']

/** The violations a visitor can pick from, in the order they're offered. */
export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'sexual', label: 'Sexual content', description: 'Nudity or sexually explicit content' },
  { value: 'violence', label: 'Violence or gore', description: 'Real-world violence or graphic injuries' },
  { value: 'hate', label: 'Hate speech', description: 'Attacks people for who they are, or shows hate symbols' },
  { value: 'harassment', label: 'Harassment or bullying', description: 'Targets, threatens or mocks someone' },
  { value: 'personal_info', label: 'Personal information', description: "Shows someone's private details, like an address or real name" },
  { value: 'illegal', label: 'Illegal activity', description: 'Shows or promotes something illegal' },
  { value: 'spam', label: 'Spam or misleading', description: 'Scams, advertising or a misleading title' },
  { value: 'copyright', label: 'Copyright', description: "Uses someone else's work without permission" },
  { value: 'other', label: 'Something else', description: 'Tell us what is wrong below' },
]

const LABELS = new Map(REPORT_REASONS.map(({ value, label }) => [value, label]))

export function reportReasonLabel(reason: ReportReason) {
  return LABELS.get(reason) ?? reason
}
