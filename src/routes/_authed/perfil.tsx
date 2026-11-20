import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ProfileLayout } from '@/features/account/ProfileLayout'

export const Route = createFileRoute('/_authed/perfil')({
  component: () => (
    <ProfileLayout>
      <Outlet />
    </ProfileLayout>
  ),
})
