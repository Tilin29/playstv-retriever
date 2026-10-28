import { createFileRoute } from '@tanstack/react-router'
import { AdminPanel } from '@/features/admin'

// Deliberately unlinked and left out of the sitemap. The URL isn't the protection:
// every admin query and mutation checks the session token server-side.
export const Route = createFileRoute('/admin-manage')({
  component: AdminPanel,
})
