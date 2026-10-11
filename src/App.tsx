import { Route, Routes } from "react-router-dom";

import RequireAuth from "./components/layout/RequireAuth";
import AppLayout from "./components/layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import GenesysSetupPage from "./pages/GenesysSetupPage";
import EmailLoginPage from "./pages/EmailLoginPage";
import OverviewPage from "./pages/OverviewPage";
import ResourcesPage from "./pages/ResourcesPage";
import ExportHistoryPage from "./pages/ExportHistoryPage";
import SettingsPage from "./pages/SettingsPage";
import SupabaseCallbackPage from "./pages/SupabaseCallbackPage";
import StandaloneOnboardingPage from "./pages/StandaloneOnboardingPage";
import GenesysOAuthCallbackPage from "./pages/GenesysOAuthCallbackPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      
      <Route path="/login" element={<LoginPage />} />

      <Route path="/login/genesys" element={<GenesysSetupPage />} />

      <Route path="/login/email" element={<EmailLoginPage />} />

      <Route path="/auth/callback" element={<SupabaseCallbackPage />} />

      <Route path="/onboarding" element={<StandaloneOnboardingPage />} />

      <Route
        path="/auth/genesys/callback"
        element={<GenesysOAuthCallbackPage />}
      />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />

          <Route path="resources" element={<ResourcesPage />} />

          <Route path="history" element={<ExportHistoryPage />} />

          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Preserve the URL and query string while the
          authentication provider processes a callback. */}
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
}
