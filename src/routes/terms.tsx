import { createFileRoute } from '@tanstack/react-router'
import { TermsOfService } from '@/features/legal'
import { useDocumentTitle } from '@/hooks/use-document-title'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
  useDocumentTitle('Terms of Service')
  return (
    <div className="mx-auto max-w-2xl">
      <TermsOfService />
    </div>
  )
}
