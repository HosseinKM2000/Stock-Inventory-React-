import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/dashboard/products/hidden/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/products/hidden/"!</div>
}
