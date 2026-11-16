import { createFileRoute } from '@tanstack/react-router'
import { LimitsReachedNotice } from '@/features/service-status'

// Lets the notice be previewed or linked to directly.
export const Route = createFileRoute('/unavailable')({
  component: LimitsReachedNotice,
})
