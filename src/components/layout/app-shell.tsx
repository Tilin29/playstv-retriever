import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import logo from '@/assets/logo.png'
import { APP_NAME } from '@/hooks/use-document-title'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-center px-4">
          <Link to="/">
            <img src={logo} alt={APP_NAME} className="h-7 w-auto" />
          </Link>
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
