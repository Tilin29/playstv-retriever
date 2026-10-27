import { useVideos } from '../hooks/use-videos'

export function VideoList() {
  const videos = useVideos()

  if (videos === undefined) return <p className="text-muted-foreground">Loading…</p>
  if (videos.length === 0) return <p className="text-muted-foreground">No videos yet.</p>

  return (
    <ul className="divide-y rounded-lg border">
      {videos.map((video) => (
        <li key={video._id} className="px-4 py-3">
          <p className="font-medium">{video.title ?? 'Untitled'}</p>
          <p className="truncate text-sm text-muted-foreground">{video.url}</p>
        </li>
      ))}
    </ul>
  )
}
