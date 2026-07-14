import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/dashboard/products/low-stock/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/products/low-stock/"!</div>
}
