import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/(app)/dashboard/products/urgent-purchase/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/products/urgent-purchase/"!</div>
}
