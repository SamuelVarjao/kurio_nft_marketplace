import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/ProfilePage'

export const Route = createFileRoute('/_authed/perfil/')({
  component: ProfilePage,
})
