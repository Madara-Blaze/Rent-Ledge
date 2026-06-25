import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { AuthProvider, useAuth } from '@/lib/auth';
import { WorkspaceProvider } from '@/lib/workspace';
import { Landing } from '@/pages/landing';
import { LoginPage } from '@/pages/login';
import { SignupPage } from '@/pages/signup';
import { AcceptInvitePage } from '@/pages/accept-invite';
import { PrivacyPolicyPage, TermsPage } from '@/pages/legal';
import { DashboardHome } from '@/pages/app/dashboard-home';
import { PropertiesPage } from '@/pages/app/properties';
import { TenanciesPage } from '@/pages/app/tenancies';
import { MaintenancePage } from '@/pages/app/maintenance';
import { EvidencePage } from '@/pages/app/evidence';
import { DisputesPage } from '@/pages/app/disputes';
import { ReportsPage } from '@/pages/app/reports';
import { RemindersPage } from '@/pages/app/reminders';
import { TeamPage } from '@/pages/app/team';
import { AuditPage } from '@/pages/app/audit';
import { TenancyOverviewPage } from '@/pages/app/tenancy/overview';
import { BillingPage } from '@/pages/app/tenancy/billing';
import { PaymentsPage } from '@/pages/app/tenancy/payments';
import { DepositPage } from '@/pages/app/tenancy/deposit';
import { AgreementsPage } from '@/pages/app/tenancy/agreements';
import { DocumentsPage } from '@/pages/app/tenancy/documents';
import { NoticesPage } from '@/pages/app/tenancy/notices';
import { HouseRulesPage } from '@/pages/app/tenancy/house-rules';
import { InspectionsPage } from '@/pages/app/tenancy/inspections';
import { TdsPage } from '@/pages/app/tenancy/tds';
import { AccountPage } from '@/pages/app/account';
import { PrivacyPage } from '@/pages/app/privacy';
import { AdminPoliciesPage } from '@/pages/app/admin-policies';

function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-black" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <WorkspaceProvider>
                  <AppShell />
                </WorkspaceProvider>
              </RequireAuth>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="tenancies" element={<TenanciesPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="evidence" element={<EvidencePage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="t/overview" element={<TenancyOverviewPage />} />
            <Route path="t/billing" element={<BillingPage />} />
            <Route path="t/payments" element={<PaymentsPage />} />
            <Route path="t/deposit" element={<DepositPage />} />
            <Route path="t/agreements" element={<AgreementsPage />} />
            <Route path="t/documents" element={<DocumentsPage />} />
            <Route path="t/notices" element={<NoticesPage />} />
            <Route path="t/house-rules" element={<HouseRulesPage />} />
            <Route path="t/inspections" element={<InspectionsPage />} />
            <Route path="t/tds" element={<TdsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="admin/policies" element={<AdminPoliciesPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
