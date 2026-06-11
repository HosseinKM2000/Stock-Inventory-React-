import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(public)/setting/categories')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(public)/setting/categories"!</div>
}
