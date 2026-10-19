import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export type SidebarItem = {
  to: string
  label: string
  icon: LucideIcon
}

export function Sidebar({
  items,
  footer,
}: {
  items: SidebarItem[]
  footer?: SidebarItem[]
}) {
  return (
    <aside className="flex h-full min-h-svh w-60 flex-col border-r border-line bg-white px-3 py-4">
      <div className="px-2 pb-4">
        <Logo compact />
        <span className="demo-chip mt-3">Demo mode</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Dashboard">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                isActive ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50',
              ].join(' ')
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      {footer ? (
        <div className="mt-auto space-y-1 border-t border-line pt-3">
          {footer.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
