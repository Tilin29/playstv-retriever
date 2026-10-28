import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import { getSessionToken, setSessionToken, subscribeToSessionToken } from '../lib/session-token'

/**
 * The signed-in admin's session. `isAdmin` is undefined while it's being checked;
 * visitors who never signed in have no token, so nothing is asked of the server.
 */
export function useAdminSession() {
  const storedToken = useSyncExternalStore(subscribeToSessionToken, getSessionToken)
  const signedIn = useQuery(
    api.admin.isSignedIn,
    storedToken ? { sessionToken: storedToken } : 'skip',
  )

  // Forget a token whose session expired or was signed out elsewhere.
  useEffect(() => {
    if (storedToken && signedIn === false) setSessionToken(null)
  }, [storedToken, signedIn])

  return {
    sessionToken: signedIn ? storedToken : null,
    isAdmin: storedToken ? signedIn : false,
  }
}

export function useSignIn() {
  const signIn = useAction(api.admin.signIn)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(password: string) {
    setPending(true)
    setError(undefined)
    try {
      setSessionToken(await signIn({ password }))
    } catch (caught) {
      setError(caught instanceof ConvexError ? String(caught.data) : "Couldn't sign in")
    } finally {
      setPending(false)
    }
  }

  return { submit, pending, error }
}

export function useSignOut() {
  const signOut = useMutation(api.admin.signOut)
  return async () => {
    const sessionToken = getSessionToken()
    setSessionToken(null)
    if (sessionToken) await signOut({ sessionToken })
  }
}
