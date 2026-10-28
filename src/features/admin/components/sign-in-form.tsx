import { useState, type FormEvent } from 'react'
import { LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useSignIn } from '../hooks/use-admin-session'

export function SignInForm() {
  const { submit, pending, error } = useSignIn()
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password) void submit(password)
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <LockIcon className="size-5 text-muted-foreground" />
        <CardTitle>Admin sign-in</CardTitle>
        <CardDescription>Enter the admin password to manage reported clips.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="admin-password">Password</FieldLabel>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" disabled={!password || pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
