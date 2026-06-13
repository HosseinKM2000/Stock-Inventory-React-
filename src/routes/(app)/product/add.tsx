import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/product/add')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/product/add-product"!</div>
}
