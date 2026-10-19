import { Link } from 'react-router-dom'

type LogoProps = {
  to?: string
  compact?: boolean
  inverted?: boolean
}

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#14635D" />
      <circle cx="18" cy="20" r="8" fill="#1F8A80" />
      <circle cx="30" cy="20" r="8" fill="#0B3D3A" />
      <circle cx="24" cy="30" r="8" fill="#E8B84A" />
      <path
        d="M18 19.5c.2 1.8 1.5 3.2 3.4 3.8M30 19.5c-.2 1.8-1.5 3.2-3.4 3.8M24 29.4c1.5.6 3.2.6 4.8 0"
        stroke="#F4FBF8"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ to = '/', compact = false, inverted = false }: LogoProps) {
  const title = inverted ? 'text-white' : 'text-brand-900'
  const tag = inverted ? 'text-white/80' : 'text-brand-700'

  const inner = (
    <span className="flex items-center gap-2.5">
      <BrandMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <span className="leading-tight text-left">
        <span className={`block font-extrabold tracking-tight ${compact ? 'text-[15px]' : 'text-base'} ${title}`}>
          Déglu Gambia
        </span>
        {compact ? null : (
          <span className={`block text-[11px] font-medium ${tag}`}>
            Your voice. Our community. A better Gambia.
          </span>
        )}
      </span>
    </span>
  )

  if (!to) return inner

  return (
    <Link to={to} className="rounded-lg focus-visible:outline-offset-4">
      {inner}
    </Link>
  )
}
