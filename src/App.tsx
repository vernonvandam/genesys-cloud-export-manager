import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import RequireAuth from './components/layout/RequireAuth'
import AppLayout from './components/layout/AppLayout'

import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import ResourcesPage from './pages/ResourcesPage'
import ExportHistoryPage from './pages/ExportHistoryPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      {/* OAuth returns to the application root. */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protect all dashboard pages. */}
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route
            path="resources"
            element={<ResourcesPage />}
          />
          <Route
            path="history"
            element={<ExportHistoryPage />}
          />
          <Route
            path="settings"
            element={<SettingsPage />}
          />
        </Route>
      </Route>

      {/* Send unknown routes back to the login page. */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}