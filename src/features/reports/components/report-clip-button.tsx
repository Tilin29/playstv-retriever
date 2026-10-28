import { useState, type FormEvent } from 'react'
import { CheckCircle2Icon, FlagIcon } from 'lucide-react'
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { APP_NAME } from '@/hooks/use-document-title'
import type { Id } from '@convex/_generated/dataModel'
import { useReportClip } from '../hooks/use-report-clip'
import { REPORT_REASONS, type ReportReason } from '../lib/reasons'

const MAX_DETAILS_LENGTH = 500

/** Opens a form for reporting the clip to the admins. */
export function ReportClipButton({ clipId }: { clipId: Id<'clips'> }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" className="text-muted-foreground" />}>
        <FlagIcon />
        Report
      </DialogTrigger>
      {/* `data-report-form` keeps the viewer's ←/→ from switching clips behind it. */}
      <DialogContent data-report-form className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {/* A fresh form each time it opens, or for another clip. */}
        {open && <ReportForm key={clipId} clipId={clipId} />}
      </DialogContent>
    </Dialog>
  )
}

function ReportForm({ clipId }: { clipId: Id<'clips'> }) {
  const { report, pending, error } = useReportClip(clipId)
  const [reason, setReason] = useState<ReportReason>()
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const needsDetails = reason === 'other' && !details.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason || needsDetails) return
    if (await report(reason, details)) setSent(true)
  }

  if (sent) {
    return (
      <>
        <DialogHeader>
          <CheckCircle2Icon className="size-8 text-primary" />
          <DialogTitle>Thanks for reporting</DialogTitle>
          <DialogDescription>An admin will review this clip.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Report clip</DialogTitle>
        <DialogDescription>
          What's wrong with this clip? Reports are anonymous.
        </DialogDescription>
      </DialogHeader>
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        {APP_NAME} doesn't own any of the clips it shows; they come from the Wayback Machine's
        public archive of Plays.tv. If a clip is found to break these rules, it's removed from
        the website and any images of it stored here are deleted.
      </p>
      <FieldSet>
        <FieldLegend variant="label" className="sr-only">
          Violation
        </FieldLegend>
        <RadioGroup
          value={reason ?? null}
          onValueChange={(value) =>
            setReason(REPORT_REASONS.find((option) => option.value === value)?.value)
          }
          className="gap-3"
        >
          {REPORT_REASONS.map((option) => (
            <Field key={option.value} orientation="horizontal">
              <RadioGroupItem value={option.value} id={`report-reason-${option.value}`} />
              <FieldContent>
                <FieldLabel htmlFor={`report-reason-${option.value}`}>{option.label}</FieldLabel>
                <FieldDescription className="text-xs">{option.description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor="report-details">
          Details {reason !== 'other' && <span className="text-muted-foreground">(optional)</span>}
        </FieldLabel>
        <Textarea
          id="report-details"
          value={details}
          maxLength={MAX_DETAILS_LENGTH}
          placeholder="Anything that helps us understand the problem"
          onChange={(event) => setDetails(event.target.value)}
        />
      </Field>
      {error && <FieldError>{error}</FieldError>}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" variant="destructive" disabled={!reason || needsDetails || pending}>
          {pending ? 'Sending…' : 'Send report'}
        </Button>
      </DialogFooter>
    </form>
  )
}
