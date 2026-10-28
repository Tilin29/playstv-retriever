import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import logoDark from '@/assets/logo-dark.png'
import logo from '@/assets/logo.png'
import { APP_NAME } from '@/hooks/use-document-title'
import { ThemeToggle } from './theme-toggle'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        {/* Three columns keep the logo centred with the toggle on the right. */}
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <Link to="/" className="col-start-2">
            <img src={logo} alt={APP_NAME} className="h-7 w-auto dark:hidden" />
            <img src={logoDark} alt={APP_NAME} className="hidden h-7 w-auto dark:block" />
          </Link>
          <div className="justify-self-end">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t">
        <p className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground">
          {APP_NAME} doesn't collect any private information. Everything it shows comes from
          the publicly available{' '}
          <a
            href="https://web.archive.org"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Wayback Machine
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
