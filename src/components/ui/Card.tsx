import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-line/80 bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-2xl font-extrabold tracking-tight text-brand-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-brand-800">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}
