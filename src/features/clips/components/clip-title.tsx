/** Shown in place of a title an admin hid. */
export const HIDDEN_TITLE_TEXT = '(Title removed due to TOS violation)'

/** A clip's title as plain text, e.g. for labels. */
export function clipTitleText(clip: { title: string | null }) {
  return clip.title ?? HIDDEN_TITLE_TEXT
}

/** A clip's title, or an italic notice when an admin hid it. */
export function ClipTitle({ clip }: { clip: { title: string | null } }) {
  if (clip.title === null) return <em className="font-normal">{HIDDEN_TITLE_TEXT}</em>
  return clip.title
}
