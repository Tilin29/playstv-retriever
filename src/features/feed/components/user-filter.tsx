import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { useFeedUser, useUserSearch } from '../hooks/use-feed'

type UserOption = {
  usernameKey: string
  username: string
  avatarUrl?: string | null
  recoveredCount?: number
}

/** Picks one uploader to show clips of, searching usernames by what they start with. */
export function UserFilter({
  usernameKey,
  onUserChange,
}: {
  usernameKey: string | undefined
  onUserChange: (usernameKey: string | undefined) => void
}) {
  const [query, setQuery] = useState('')
  const users = useUserSearch(query)
  const selected = useFeedUser(usernameKey)
  const value: UserOption | null = usernameKey
    ? { usernameKey, username: selected?.username ?? usernameKey }
    : null

  return (
    <Combobox
      items={users ?? []}
      value={value}
      onValueChange={(user: UserOption | null) => onUserChange(user?.usernameKey)}
      onInputValueChange={setQuery}
      itemToStringLabel={(user: UserOption) => user.username}
      isItemEqualToValue={(a: UserOption, b: UserOption) => a.usernameKey === b.usernameKey}
      // The server already matched the usernames to what was typed.
      filter={null}
    >
      <ComboboxInput placeholder="Any user" aria-label="User" showClear className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>
          {!query.trim()
            ? 'Type a username.'
            : users === undefined
              ? 'Searching…'
              : 'No users with recovered clips.'}
        </ComboboxEmpty>
        <ComboboxList>
          {(user: UserOption) => (
            <ComboboxItem key={user.usernameKey} value={user}>
              <Avatar size="sm">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{user.username}</span>
              {user.recoveredCount !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {user.recoveredCount}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
