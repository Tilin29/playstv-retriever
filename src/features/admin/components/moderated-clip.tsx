import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ReportedClip } from '../hooks/use-moderation'

/** A clip under review: its video, who it belongs to, and whatever `children` adds. */
export function ModeratedClip({
  clip,
  actions,
  children,
}: {
  clip: ReportedClip['clip']
  actions: ReactNode
  children: ReactNode
}) {
  const { owner } = clip
  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,18rem)_1fr]">
      {clip.videoUrl ? (
        <video
          src={clip.videoUrl}
          poster={clip.thumbnailUrl ?? undefined}
          controls
          preload="none"
          className="aspect-video w-full rounded-md bg-black"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
          No full video
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium leading-snug break-words">
            {clip.title}
            {clip.titleHidden && (
              <Badge variant="outline" className="ml-2 align-middle">
                Title hidden
              </Badge>
            )}
          </p>
          <Link
            to="/u/$username"
            params={{ username: owner.usernameKey }}
            className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Avatar size="sm">
              {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
              <AvatarFallback>{owner.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {owner.username}
            {clip.gameName && <span>· {clip.gameName}</span>}
          </Link>
        </div>
        {children}
        <div className="mt-auto flex flex-wrap gap-2">{actions}</div>
      </div>
    </Card>
  )
}
