import { REPORT_CATEGORIES } from '@/data/types'
import type { Report, ReportCategory, ReportStatus } from '@/data/types'

export function countByStatus(reports: Report[]): Record<ReportStatus, number> {
  return {
    submitted: reports.filter((r) => r.status === 'submitted').length,
    under_review: reports.filter((r) => r.status === 'under_review').length,
    assigned: reports.filter((r) => r.status === 'assigned').length,
    in_progress: reports.filter((r) => r.status === 'in_progress').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  }
}

export function countByCategory(reports: Report[]): { category: ReportCategory; count: number }[] {
  return REPORT_CATEGORIES.map((category) => ({
    category,
    count: reports.filter((r) => r.category === category).length,
  }))
}

export function resolutionRate(reports: Report[]): number | null {
  if (reports.length === 0) return null
  return Math.round((reports.filter((r) => r.status === 'resolved').length / reports.length) * 100)
}

export function unresolvedCount(reports: Report[]): number {
  return reports.filter((r) => r.status !== 'resolved').length
}

export function averageHandlingHours(reports: Report[]): number | null {
  const resolved = reports.filter((r) => r.status === 'resolved')
  if (resolved.length === 0) return null
  const total = resolved.reduce((sum, report) => {
    return sum + (new Date(report.updatedAt).getTime() - new Date(report.createdAt).getTime())
  }, 0)
  return Math.round(total / resolved.length / 3_600_000)
}

export function countByCommunity(reports: Report[]): { communityId: string; count: number }[] {
  const map = new Map<string, number>()
  for (const report of reports) {
    map.set(report.communityId, (map.get(report.communityId) ?? 0) + 1)
  }
  return [...map.entries()].map(([communityId, count]) => ({ communityId, count }))
}
