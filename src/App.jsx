import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import { canDo } from './lib/utils'

// ── Lazy-loaded pages (each becomes its own JS chunk) ─────────────────────────
// Vite splits these at the dynamic import boundary, so users only download
// the code for pages they actually visit. Initial bundle drops from ~1.1 MB
// to ~200 KB.

// Auth / public landing
const LoginPage          = lazy(() => import('./pages/LoginPage'))
const MarketingPage      = lazy(() => import('./pages/MarketingPage'))
const SignupPage         = lazy(() => import('./pages/SignupPage'))
const DemoPage           = lazy(() => import('./pages/DemoPage'))

// CPA partner public routes
const CpaLoginPage       = lazy(() => import('./pages/CpaLoginPage'))
const CpaRegisterPage    = lazy(() => import('./pages/CpaRegisterPage'))
const PartnersPage       = lazy(() => import('./pages/PartnersPage'))
const MethodologyPage    = lazy(() => import('./pages/MethodologyPage'))
const CpaReviewPage      = lazy(() => import('./pages/CpaReviewPage'))
const ReferralIntakePage = lazy(() => import('./pages/ReferralIntakePage'))

// Core app
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const ClustersPage       = lazy(() => import('./pages/ClustersPage'))
const ClusterDetailPage  = lazy(() => import('./pages/ClusterDetailPage'))
const ReportsPage        = lazy(() => import('./pages/ReportsPage'))
const AnalyticsPage      = lazy(() => import('./pages/AnalyticsPage'))
const ActivityLogPage    = lazy(() => import('./pages/ActivityLogPage'))
const AuditLogPage       = lazy(() => import('./pages/AuditLogPage'))
const AuditReadinessPage = lazy(() => import('./pages/AuditReadinessPage'))
const DocumentVaultPage  = lazy(() => import('./pages/DocumentVaultPage'))
const IntegrationsPage   = lazy(() => import('./pages/IntegrationsPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const UsersPage          = lazy(() => import('./pages/UsersPage'))
const JiraSprintPage     = lazy(() => import('./pages/JiraSprintPage'))

// Admin
const AdminLeadsPage     = lazy(() => import('./pages/AdminLeadsPage'))
const AdminFunnelPage    = lazy(() => import('./pages/AdminFunnelPage'))

// CPA portal
const CPAPortalPage          = lazy(() => import('./pages/CPAPortalPage'))
const ReferralDashboardPage  = lazy(() => import('./pages/ReferralDashboardPage'))

// Dev / config
const RateCardPage         = lazy(() => import('./pages/RateCardPage'))
const DeveloperPortalPage  = lazy(() => import('./pages/DeveloperPortalPage'))
const HeuristicConfigPage  = lazy(() => import('./pages/HeuristicConfigPage'))
const OnboardingWizardPage = lazy(() => import('./pages/OnboardingWizardPage'))
const QuickConnectPage     = lazy(() => import('./pages/QuickConnectPage'))
const EligibilityQuizPage  = lazy(() => import('./pages/EligibilityQuizPage'))

// Public marketing / pricing
const PricingPage          = lazy(() => import('./pages/PricingPage'))
const SecurityPage         = lazy(() => import('./pages/SecurityPage'))
const EstimatorPage        = lazy(() => import('./pages/EstimatorPage'))
const ShareableSummaryPage = lazy(() => import('./pages/ShareableSummaryPage'))
const OAuthCallbackPage    = lazy(() => import('./pages/OAuthCallbackPage'))
const CheckoutSuccessPage  = lazy(() => import('./pages/CheckoutSuccessPage'))
const CheckoutCancelPage   = lazy(() => import('./pages/CheckoutCancelPage'))
const WelcomePage          = lazy(() => import('./pages/WelcomePage'))

// Scan funnel
const ScanLandingPage = lazy(() => import('./pages/scan/ScanLandingPage'))
const ScanReposPage   = lazy(() => import('./pages/scan/ScanReposPage'))
const ScanRunningPage = lazy(() => import('./pages/scan/ScanRunningPage'))
const ScanResultsPage = lazy(() => import('./pages/scan/ScanResultsPage'))

// Grants module
const GrantsDashboard    = lazy(() => import('./pages/grants/GrantsDashboard'))
const EligibilityResults = lazy(() => import('./pages/grants/EligibilityResults'))
const GapFillInterview   = lazy(() => import('./pages/grants/GapFillInterview'))
const GeneratingSections = lazy(() => import('./pages/grants/GeneratingSections'))
const SectionReview      = lazy(() => import('./pages/grants/SectionReview'))
const ExportPage         = lazy(() => import('./pages/grants/ExportPage'))
const ApplicationTracker = lazy(() => import('./pages/grants/ApplicationTracker'))
const PlanUpgradeGate    = lazy(() => import('./pages/grants/PlanUpgradeGate'))

// ── Page loading fallback ─────────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
    <Suspense fallback={<PageSpinner />}>
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
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
