import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CheckIcon, ListIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useRecordSearch } from '@/hooks/use-record-search'
import { cn } from '@/lib/utils'
import { MAX_CLIP_LINKS, parseClipLinks } from '../lib/parse-links'

/** Opens a box for pasting clip links, one per line, and shows what was found. */
export function ClipLinksButton({ variant = 'outline' }: { variant?: 'outline' | 'ghost' }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} />}>
        <ListIcon />
        Look up clip links
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {open && <ClipLinksForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ClipLinksForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const recordSearch = useRecordSearch()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const { keys, lines, invalidCount } = parseClipLinks(text)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (keys.length === 0) {
      setError('Paste at least one Plays.tv clip link.')
      return
    }
    if (keys.length > MAX_CLIP_LINKS) {
      setError(`Look up at most ${MAX_CLIP_LINKS} links at once.`)
      return
    }
    recordSearch('links', keys)
    onDone()
    void navigate({ to: '/lookup', search: { ids: keys.join(',') } })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Look up clip links</DialogTitle>
        <DialogDescription>
          Paste links to Plays.tv clips, one per line, and see which ones the Wayback Machine
          saved.
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="clip-links">Clip links</FieldLabel>
        <LinksInput
          value={text}
          lines={lines}
          invalid={error !== undefined}
          onChange={(value) => {
            setText(value)
            if (error) setError(undefined)
          }}
        />
        <FieldDescription id="clip-links-summary">
          {keys.length} {keys.length === 1 ? 'link' : 'links'}
          {invalidCount > 0 &&
            ` · ${invalidCount} ${invalidCount === 1 ? 'line isn’t' : 'lines aren’t'} a clip link and will be skipped`}
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Look up</Button>
      </DialogFooter>
    </form>
  )
}

// Each line is one row of this height, in both the text box and the gutter beside it.
const LINE_HEIGHT_CLASS = 'h-5 leading-5'

/**
 * The text box for links, with a gutter beside it marking each line as a valid clip
 * link (✓) or not (✗). Lines don't wrap, so the marks stay level with their line; long
 * links scroll sideways inside the box instead.
 */
function LinksInput({
  value,
  lines,
  invalid,
  onChange,
}: {
  value: string
  lines: ('valid' | 'invalid' | 'blank')[]
  invalid: boolean
  onChange: (value: string) => void
}) {
  const gutterRef = useRef<HTMLDivElement>(null)
  return (
    <div
      className={cn(
        'flex h-48 overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        invalid && 'border-destructive ring-3 ring-destructive/20',
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden
        // Extra room at the bottom for when the text box shows a horizontal scrollbar.
        className="w-7 shrink-0 overflow-hidden border-r bg-muted/50 pt-2 pb-6"
      >
        {lines.map((line, index) => (
          <div key={index} className={cn('flex items-center justify-center', LINE_HEIGHT_CLASS)}>
            {line === 'valid' && (
              <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            {line === 'invalid' && <XIcon className="size-3.5 text-destructive" />}
          </div>
        ))}
      </div>
      <Textarea
        id="clip-links"
        wrap="off"
        autoFocus
        spellCheck={false}
        aria-describedby="clip-links-summary"
        aria-invalid={invalid ? true : undefined}
        placeholder={'https://plays.tv/video/58752c9e322090d343/dis-iz-a-muggen\nhttps://plays.tv/s/LxWhpqrdpPoL'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
        }}
        // The wrapper draws the border and focus ring; the box itself scrolls, at a fixed
        // size, so pasting many or long links never stretches the popup.
        className="h-full min-h-0 resize-none overflow-auto rounded-none border-0 bg-transparent px-2 pt-2 pb-2 font-mono text-xs leading-5 whitespace-pre shadow-none field-sizing-fixed focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent"
      />
    </div>
  )
}