import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/dashboard/products/out-of-stock/')(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/products/out-of-stock/"!</div>
}
