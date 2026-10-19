import type { ReactNode } from 'react'

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[270px] rounded-[2.1rem] border-[10px] border-brand-950 bg-brand-950 shadow-[var(--shadow-card)]">
      <div className="overflow-hidden rounded-[1.45rem] bg-white">{children}</div>
    </div>
  )
}
