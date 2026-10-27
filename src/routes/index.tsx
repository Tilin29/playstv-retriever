import { createFileRoute } from '@tanstack/react-router'
import { VideoList } from '@/features/videos'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <VideoList />
}
