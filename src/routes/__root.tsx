import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AppShell } from '@/components/layout/app-shell'
import { ServiceStatusGate } from '@/features/service-status'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <AppShell>
        <ServiceStatusGate>
          <Outlet />
        </ServiceStatusGate>
      </AppShell>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

function NotFound() {
  return (
    <div className="space-y-2">
      <p className="font-medium">Page not found.</p>
      <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to home
      </Link>
    </div>
  )
}
