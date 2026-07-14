import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/dashboard/products/no-price/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/products/no-price/"!</div>
}
