import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AppStateProvider } from '@/context/AppState'
import { LanguageProvider } from '@/i18n/LanguageContext'
import { AdminGuard, StaffGuard } from '@/layouts/WorkspaceLayout'
import { AboutPage } from '@/pages/AboutPage'
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage'
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage'
import { AdminHomePage } from '@/pages/admin/AdminHomePage'
import { AdminRoutingPage } from '@/pages/admin/AdminRoutingPage'
import { AdminUnassignedPage } from '@/pages/admin/AdminUnassignedPage'
import { CommunityDashboardPage } from '@/pages/CommunityDashboardPage'
import { ConfirmPage } from '@/pages/ConfirmPage'
import { GetStartedPage } from '@/pages/GetStartedPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { LandingPage } from '@/pages/LandingPage'
import { MapPage } from '@/pages/MapPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ReportPage } from '@/pages/ReportPage'
import { SignInPage } from '@/pages/SignInPage'
import { StaffDashboardPage } from '@/pages/staff/StaffDashboardPage'
import { StaffDeniedPage } from '@/pages/staff/StaffDeniedPage'
import { StaffReportPage } from '@/pages/staff/StaffReportPage'
import { TrackPage } from '@/pages/TrackPage'

export default function App() {
  return (
    <LanguageProvider>
      <AppStateProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/get-started" element={<GetStartedPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/dashboard" element={<CommunityDashboardPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/report/confirm/:reference" element={<ConfirmPage />} />
              <Route path="/track" element={<TrackPage />} />
              <Route path="/track/:reference" element={<TrackPage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/staff/denied" element={<StaffDeniedPage />} />
              <Route element={<StaffGuard />}>
                <Route path="/staff" element={<StaffDashboardPage />} />
                <Route path="/staff/reports/:id" element={<StaffReportPage />} />
              </Route>
              <Route element={<AdminGuard />}>
                <Route path="/admin" element={<AdminHomePage />} />
                <Route path="/admin/unassigned" element={<AdminUnassignedPage />} />
                <Route path="/admin/routing" element={<AdminRoutingPage />} />
                <Route path="/admin/audit" element={<AdminAuditPage />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppStateProvider>
    </LanguageProvider>
  )
}
