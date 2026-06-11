import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(public)/setting/export')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(public)/setting/export"!</div>
}
