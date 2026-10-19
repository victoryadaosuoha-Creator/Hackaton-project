import {
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MapPinned,
  ScrollText,
  Shield,
  UserRoundX,
} from 'lucide-react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { DemoBanner } from '@/components/system/DemoBanner'
import { Button } from '@/components/ui/Button'
import { Sidebar, type SidebarItem } from '@/components/ui/Sidebar'
import { useAppState } from '@/context/AppState'

const staffItems: SidebarItem[] = [
  { to: '/staff', label: 'Inbox', icon: LayoutDashboard },
  { to: '/map', label: 'Map', icon: MapPinned },
]

const adminItems: SidebarItem[] = [
  { to: '/admin', label: 'Overview', icon: Shield },
  { to: '/admin/unassigned', label: 'Unassigned', icon: UserRoundX },
  { to: '/admin/routing', label: 'Routing', icon: GitBranch },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/analytics', label: 'Analytics', icon: ClipboardList },
  { to: '/staff', label: 'All reports', icon: LayoutDashboard },
]

export function StaffGuard() {
  const { session } = useAppState()
  if (!session) return <Navigate to="/signin" replace />
  if (session.role === 'citizen') return <Navigate to="/" replace />
  if (!session.staffActive) return <Navigate to="/staff/denied" replace />
  return <WorkspaceShell />
}

export function AdminGuard() {
  const { session } = useAppState()
  if (!session) return <Navigate to="/signin" replace />
  if (session.role !== 'admin' || !session.staffActive) return <Navigate to="/staff" replace />
  return <WorkspaceShell />
}

function WorkspaceShell() {
  const { session, signOut } = useAppState()
  const items = session?.role === 'admin' ? adminItems : staffItems

  return (
    <div className="min-h-svh bg-canvas">
      <DemoBanner />
      <div className="lg:flex">
        <div className="hidden lg:block">
          <Sidebar items={items} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
            <div>
              <p className="text-sm font-bold text-brand-900">{session?.label}</p>
              <p className="text-xs text-muted">
                {session?.role === 'admin' ? 'Administrator' : 'Institution staff'}
                {session?.isDemo ? ' · demonstration session' : ' · Supabase session'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void signOut()
              }}
            >
              <LogOut size={14} />
              Sign out
            </Button>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-b border-line bg-white px-3 py-2 lg:hidden" aria-label="Workspace">
            {items.map((item) => (
              <Link key={item.to} to={item.to} className="whitespace-nowrap rounded-lg bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
