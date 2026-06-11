import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(public)/setting/appearance')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(public)/setting/appearance"!</div>
}
