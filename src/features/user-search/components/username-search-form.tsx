import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { parseUsername } from '../lib/username'

type UsernameSearchFormProps = {
  defaultValue?: string
  autoFocus?: boolean
}

export function UsernameSearchForm({ defaultValue = '', autoFocus }: UsernameSearchFormProps) {
  const navigate = useNavigate()
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string>()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = parseUsername(value)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(undefined)
    void navigate({ to: '/u/$username', params: { username: result.username } })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="username" className="sr-only">
          Plays.tv username
        </FieldLabel>
        <div className="flex gap-2">
          <InputGroup className="h-11 flex-1">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              id="username"
              name="username"
              placeholder="Plays.tv username or profile link"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={autoFocus}
              value={value}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setValue(event.target.value)
                if (error) setError(undefined)
              }}
            />
          </InputGroup>
          <Button type="submit" className="h-11 px-4">
            Find clips
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  )
}
