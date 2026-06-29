import LoginComponent from '@/features/auth/components/Login';
import { createFileRoute } from '@tanstack/react-router'


export const Route = createFileRoute("/auth/login")({
  component: LoginComponent,
});


