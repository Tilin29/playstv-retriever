import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
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
        <InputGroup className="h-11">
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
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  )
}
