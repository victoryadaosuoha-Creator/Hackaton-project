import type { ReactNode } from 'react'
import { DemoBanner } from '@/components/system/DemoBanner'
import { PublicFooter } from './PublicFooter'
import { PublicHeader } from './PublicHeader'

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-canvas">
      <DemoBanner />
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
