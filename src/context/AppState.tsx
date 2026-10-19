import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Report, Session } from '@/data/types'
import { getBackendMode } from '@/services/backendMode'
import { submitDraft, type SubmitResult } from '@/services/reportsApi'
import { signOutRemote } from '@/services/staffAuth'
import {
  assignUnassigned,
  demoAccounts,
  getAudit,
  getRouting,
  listReports,
  loadSession,
  saveSession,
  supportReport,
  updateReportStatus,
  updateRouting,
} from '@/services/store'

type AppStateValue = {
  reports: Report[]
  session: Session | null
  backendMode: ReturnType<typeof getBackendMode>
  refresh: () => void
  signIn: (session: Session) => void
  signOut: () => Promise<void>
  accounts: Session[]
  submit: (draft: Parameters<typeof submitDraft>[0], preferLocalDemo?: boolean) => Promise<SubmitResult>
  support: typeof supportReport
  updateStatus: typeof updateReportStatus
  setRouting: typeof updateRouting
  assign: typeof assignUnassigned
  routing: ReturnType<typeof getRouting>
  audit: ReturnType<typeof getAudit>
}

const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0)
  const refresh = () => setTick((value) => value + 1)
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const value = useMemo<AppStateValue>(() => {
    return {
      reports: listReports(),
      session,
      backendMode: getBackendMode(),
      refresh,
      accounts: demoAccounts(),
      routing: getRouting(),
      audit: getAudit(),
      signIn: (next) => {
        saveSession(next)
        setSession(next)
      },
      signOut: async () => {
        await signOutRemote()
        saveSession(null)
        setSession(null)
      },
      submit: async (draft, preferLocalDemo) => {
        const result = await submitDraft(draft, preferLocalDemo)
        refresh()
        return result
      },
      support: (id) => {
        const report = supportReport(id)
        refresh()
        return report
      },
      updateStatus: (input) => {
        const result = updateReportStatus(input)
        refresh()
        return result
      },
      setRouting: (category, institutionId, current) => {
        updateRouting(category, institutionId, current)
        refresh()
      },
      assign: (id, institutionId, current) => {
        assignUnassigned(id, institutionId, current)
        refresh()
      },
    }
  }, [session])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('AppStateProvider is missing')
  return value
}
