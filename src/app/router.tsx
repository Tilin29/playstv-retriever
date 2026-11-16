import { createRouter } from '@tanstack/react-router'
import { RouteError } from '@/features/service-status'
import { routeTree } from '@/routeTree.gen'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // A page whose queries fail shows the limits notice when the backend is unavailable.
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
