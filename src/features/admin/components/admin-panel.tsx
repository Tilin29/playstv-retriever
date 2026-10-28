import { useEffect } from 'react'
import { LogOutIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useAdminSession, useSignOut } from '../hooks/use-admin-session'
import { useBlacklistedClips, useReportedClips, useTitleFlags } from '../hooks/use-moderation'
import { BlacklistedClips } from './blacklisted-clips'
import { OffensiveTitles } from './offensive-titles'
import { ReportedClips } from './reported-clips'
import { SearchLog } from './search-log'
import { SignInForm } from './sign-in-form'

/**
 * Sign-in, then the reported, blacklisted and offensively titled clips. Every action is
 * checked server-side.
 */
export function AdminPanel() {
  const { sessionToken, isAdmin } = useAdminSession()
  useDocumentTitle('Admin')
  useNoIndex()

  if (isAdmin === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (!sessionToken) return <SignInForm />
  return <Moderation sessionToken={sessionToken} />
}

function Moderation({ sessionToken }: { sessionToken: string }) {
  const signOut = useSignOut()
  const reported = useReportedClips(sessionToken) ?? undefined
  const blacklisted = useBlacklistedClips(sessionToken) ?? undefined
  const flaggedTitles = useTitleFlags(sessionToken, 'open') ?? undefined

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Blacklisted clips are hidden everywhere except here.
          </p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOutIcon />
          Sign out
        </Button>
      </div>
      <Tabs defaultValue="reports" className="gap-4">
        <TabsList>
          <TabsTrigger value="reports">
            Reports{reported !== undefined && ` (${reported.length})`}
          </TabsTrigger>
          <TabsTrigger value="blacklisted">
            Blacklisted{blacklisted !== undefined && ` (${blacklisted.length})`}
          </TabsTrigger>
          <TabsTrigger value="titles">
            Offensive titles{flaggedTitles !== undefined && ` (${flaggedTitles.length})`}
          </TabsTrigger>
          <TabsTrigger value="searches">Searches</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportedClips sessionToken={sessionToken} reported={reported} />
        </TabsContent>
        <TabsContent value="blacklisted">
          <BlacklistedClips sessionToken={sessionToken} blacklisted={blacklisted} />
        </TabsContent>
        <TabsContent value="titles">
          <OffensiveTitles sessionToken={sessionToken} open={flaggedTitles} />
        </TabsContent>
        <TabsContent value="searches">
          <SearchLog sessionToken={sessionToken} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

/** Asks search engines not to index the page while it's shown. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => meta.remove()
  }, [])
}
