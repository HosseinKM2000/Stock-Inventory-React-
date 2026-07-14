import { createFileRoute } from '@tanstack/react-router'
import DashboardComponent from '@/features/app/dashboard/components'

export const Route = createFileRoute('/(app)/dashboard/')({
  component: DashboardComponent,
})
