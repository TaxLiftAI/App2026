import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import CpaLoginPage    from './pages/CpaLoginPage'
import PartnersPage    from './pages/PartnersPage'
import CpaRegisterPage from './pages/CpaRegisterPage'
import MethodologyPage from './pages/MethodologyPage'
import DashboardPage from './pages/DashboardPage'
import ClustersPage from './pages/ClustersPage'
import ClusterDetailPage from './pages/ClusterDetailPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import AuditLogPage from './pages/AuditLogPage'
import IntegrationsPage from './pages/IntegrationsPage'
import RateCardPage from './pages/RateCardPage'
import DeveloperPortalPage from './pages/DeveloperPortalPage'
import HeuristicConfigPage from './pages/HeuristicConfigPage'
import OnboardingWizardPage from './pages/OnboardingWizardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ActivityLogPage from './pages/ActivityLogPage'
import AuditReadinessPage from './pages/AuditReadinessPage'
import DocumentVaultPage from './pages/DocumentVaultPage'
import EligibilityQuizPage from './pages/EligibilityQuizPage'
import SettingsPage from './pages/SettingsPage'
import CPAPortalPage from './pages/CPAPortalPage'
import EstimatorPage from './pages/EstimatorPage'
import ShareableSummaryPage from './pages/ShareableSummaryPage'
import QuickConnectPage from './pages/QuickConnectPage'
import CpaReviewPage from './pages/CpaReviewPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import ReferralDashboardPage from './pages/ReferralDashboardPage'
import ReferralIntakePage from './pages/ReferralIntakePage'
import MarketingPage from './pages/MarketingPage'
import ScanLandingPage from './pages/scan/ScanLandingPage'
import ScanReposPage   from './pages/scan/ScanReposPage'
import ScanRunningPage from './pages/scan/ScanRunningPage'
import ScanResultsPage from './pages/scan/ScanResultsPage'
import PricingPage         from './pages/PricingPage'
import SecurityPage        from './pages/SecurityPage'
import DemoPage            from './pages/DemoPage'
import SignupPage          from './pages/SignupPage'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage'
import CheckoutCancelPage  from './pages/CheckoutCancelPage'
import WelcomePage         from './pages/WelcomePage'
import AdminLeadsPage      from './pages/AdminLeadsPage'
import AdminFunnelPage     from './pages/AdminFunnelPage'
import JiraSprintPage      from './pages/JiraSprintPage'
import GrantsDashboard     from './pages/grants/GrantsDashboard'
import EligibilityResults  from './pages/grants/EligibilityResults'
import GapFillInterview    from './pages/grants/GapFillInterview'
import GeneratingSections  from './pages/grants/GeneratingSections'
import SectionReview       from './pages/grants/SectionReview'
import ExportPage          from './pages/grants/ExportPage'
import ApplicationTracker  from './pages/grants/ApplicationTracker'
import PlanUpgradeGate     from './pages/grants/PlanUpgradeGate'
import { canDo } from './lib/utils'

function ProtectedRoute({ children, action }) {
  const { currentUser, authLoading } = useAuth()
  // Only block render while loading AND we have no user yet (session restore in progress).
  // If currentUser is already set (e.g. demo login), render immediately so the dashboard
  // doesn't show blank while a stale authApi.me() call is still in-flight.
  if (authLoading && !currentUser) return null
  if (!currentUser) return <Navigate to="/login" replace />
  if (action && !canDo(action, currentUser.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 font-medium">Access denied</p>
          <p className="text-sm text-gray-400 mt-1">Your role ({currentUser.role}) does not have permission to view this page.</p>
        </div>
      </div>
    )
  }
  return children
}

function AppRoutes() {
  const { currentUser } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Public marketing homepage */}
      <Route path="/" element={currentUser ? <Navigate to="/dashboard" replace /> : <MarketingPage />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><DashboardPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/clusters" element={
        <ProtectedRoute action="viewClusters">
          <Layout><ClustersPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/clusters/:id" element={
        <ProtectedRoute action="viewClusters">
          <Layout><ClusterDetailPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute action="viewReports">
          <Layout><ReportsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/users" element={
        <ProtectedRoute action="viewUsers">
          <Layout><UsersPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/audit-log" element={
        <ProtectedRoute action="viewAuditLog">
          <Layout><AuditLogPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/integrations" element={
        <ProtectedRoute action="viewIntegrations">
          <Layout><IntegrationsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/jira-sprint" element={
        <ProtectedRoute>
          <Layout><JiraSprintPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/rate-card" element={
        <ProtectedRoute action="viewRateCard">
          <Layout><RateCardPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/dev-portal" element={
        <ProtectedRoute action="viewDevPortal">
          <Layout><DeveloperPortalPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/heuristics" element={
        <ProtectedRoute action="viewHeuristics">
          <Layout><HeuristicConfigPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/analytics" element={
        <ProtectedRoute action="viewAnalytics">
          <Layout><AnalyticsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/activity" element={
        <ProtectedRoute action="viewActivity">
          <Layout><ActivityLogPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/audit-readiness" element={
        <ProtectedRoute action="viewAuditReadiness">
          <Layout><AuditReadinessPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/vault" element={
        <ProtectedRoute action="viewVault">
          <Layout><DocumentVaultPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/quiz" element={
        <ProtectedRoute>
          <Layout><EligibilityQuizPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><SettingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/cpa-portal" element={
        <ProtectedRoute action="viewCPAPortal">
          <Layout><CPAPortalPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/cpa-portal/referrals" element={
        <ProtectedRoute action="viewCPAPortal">
          <Layout><ReferralDashboardPage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Grants module routes ────────────────────────────────────────────── */}
      <Route path="/grants" element={
        <ProtectedRoute>
          <Layout><GrantsDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/grants/upgrade" element={
        <ProtectedRoute>
          <Layout><PlanUpgradeGate /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/grants/eligibility" element={
        <ProtectedRoute>
          <Layout><EligibilityResults /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/grants/tracker" element={
        <ProtectedRoute>
          <Layout><ApplicationTracker /></Layout>
        </ProtectedRoute>
      } />

      {/* Gap fill interview — full-page (no sidebar chrome) */}
      <Route path="/grants/interview" element={
        <ProtectedRoute>
          <GapFillInterview />
        </ProtectedRoute>
      } />

      {/* Application-specific routes */}
      <Route path="/grants/applications/:id/generating" element={
        <ProtectedRoute>
          <GeneratingSections />
        </ProtectedRoute>
      } />

      <Route path="/grants/applications/:id/review" element={
        <ProtectedRoute>
          <Layout><SectionReview /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/grants/applications/:id/export" element={
        <ProtectedRoute>
          <Layout><ExportPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Onboarding wizard — Admin only, renders outside main Layout (full-page) */}
      <Route path="/onboarding" element={
        <ProtectedRoute action="viewIntegrations">
          <OnboardingWizardPage />
        </ProtectedRoute>
      } />

      {/* Quick Connect — authenticated, full-page */}
      <Route path="/quick-connect" element={
        <ProtectedRoute>
          <QuickConnectPage />
        </ProtectedRoute>
      } />

      {/* ── CPA partner public routes (Blocker 1–3 fix) ─────────────────────── */}
      <Route path="/partners"      element={<PartnersPage />} />
      <Route path="/cpa/login"     element={<CpaLoginPage />} />
      <Route path="/cpa/register"  element={<CpaRegisterPage />} />
      <Route path="/methodology"   element={<MethodologyPage />} />

      {/* Public routes — no auth required */}
      <Route path="/demo"     element={<DemoPage />} />
      <Route path="/pricing"  element={<PricingPage />} />
      <Route path="/signup"   element={<SignupPage />} />
      <Route path="/estimate" element={<EstimatorPage />} />
      <Route path="/share/:token" element={<ShareableSummaryPage />} />
      <Route path="/cpa-review/:token" element={<CpaReviewPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/start" element={<ReferralIntakePage />} />
      <Route path="/success" element={<CheckoutSuccessPage />} />
      <Route path="/cancel"  element={<CheckoutCancelPage />} />
      <Route path="/welcome" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />

      {/* Free scan funnel — public, no auth required */}
      <Route path="/security" element={<SecurityPage />} />

      {/* Free scan funnel — public, no auth required */}
      <Route path="/scan"         element={<ScanLandingPage />} />
      <Route path="/scan/repos"   element={<ScanReposPage />} />
      <Route path="/scan/running" element={<ScanRunningPage />} />
      <Route path="/scan/results" element={<ScanResultsPage />} />

      {/* Admin routes */}
      <Route path="/admin/leads" element={
        <ProtectedRoute action="viewUsers">
          <AdminLeadsPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/funnel" element={
        <ProtectedRoute action="viewUsers">
          <AdminFunnelPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
