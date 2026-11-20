import { lazy, Suspense } from 'react'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { SessionEffects } from '@/app/SessionEffects'
import { LiveRegion } from '@/lib/announce'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import type { RouterContext } from '@/router'

const MockPanel = import.meta.env.VITE_ENABLE_MOCKS !== 'false' ? lazy(() => import('@/mocks/panel/MockPanel')) : null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <RealtimeProvider>
      <>
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-sm bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Pular para o conteúdo
        </a>
        <Header />
        <main id="conteudo" tabIndex={-1} className="min-h-[calc(100dvh-4rem)] outline-none">
          <Outlet />
        </main>
        <Footer />
        <MobileNav />
        <LiveRegion />
        <Toaster position="top-right" closeButton richColors={false} duration={3500} mobileOffset={{ top: 4, left: 8, right: 8 }} />
        <SessionEffects />
        {MockPanel ? (
          <Suspense fallback={null}>
            <MockPanel />
          </Suspense>
        ) : null}
      </>
    </RealtimeProvider>
  )
}
