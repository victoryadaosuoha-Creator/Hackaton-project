import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

type Common = {
  variant?: Variant
  size?: Size
  children: ReactNode
  className?: string
}

const styles: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white shadow-soft hover:bg-brand-800 border border-brand-800/20',
  secondary:
    'bg-white/90 text-brand-800 border border-white/80 shadow-soft hover:bg-white',
  ghost: 'bg-transparent text-brand-800 hover:bg-brand-100',
  outline: 'bg-white text-brand-800 border border-line hover:bg-brand-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-[15px] rounded-xl font-semibold',
}

function cx(variant: Variant, size: Size, className?: string) {
  return [
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
    styles[variant],
    sizes[size],
    className ?? '',
  ].join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type = 'button',
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx(variant, size, className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  to,
}: Common & { to: string }) {
  return (
    <Link to={to} className={cx(variant, size, className)}>
      {children}
    </Link>
  )
}
