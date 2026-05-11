import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/login')({
  component: () => (
    <div>
      <h1>Welcome Back</h1>
      <form>...</form>
    </div>
  ),
})
