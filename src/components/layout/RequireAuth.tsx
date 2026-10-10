import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'

function hasCompleteLaunchConfig(search: string) {
  const params = new URLSearchParams(search)

  const clientId =
    params.get('clientId') ||
    params.get('gc_clientId')

  const region =
    params.get('region') ||
    params.get('gc_region')

  const redirectUri =
    params.get('redirectUri') ||
    params.get('redirectURI') ||
    params.get('gc_redirectUrl')

  return Boolean(
    clientId?.trim() &&
    region?.trim() &&
    redirectUri?.trim(),
  )
}

export default function RequireAuth() {
  const {
    user,
    isBusy,
    error,
    status,
  } = useAuth()

  const location = useLocation()

  const params = new URLSearchParams(
    location.search,
  )

  const isOAuthCallback =
    params.has('code') || params.has('error')

  const isIntegratedLaunch =
    hasCompleteLaunchConfig(location.search)

  const hasFailed =
    Boolean(error) ||
    status === 'Authentication failed' ||
    status === 'Configuration missing'

  if (user) {
    return <Outlet />
  }

  // Let the authentication provider process OAuth callbacks.
  if (isOAuthCallback && !hasFailed) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">
            Completing sign-in
          </h1>
          <p className="auth-description">
            Please wait while your session is verified.
          </p>
        </main>
      </div>
    )
  }

  if (isOAuthCallback && hasFailed) {
    return <Navigate to="/" replace />
  }

  // A dashboard route launched with config should go to
  // the login button, not automatically start authentication.
  if (isIntegratedLaunch) {
    return (
      <Navigate
        to={`/${location.search}`}
        replace
      />
    )
  }

  if (isBusy) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">
            Connecting to Genesys Cloud
          </h1>
          <p className="auth-description">
            Please wait while your session is verified.
          </p>
        </main>
      </div>
    )
  }

  return (
    <Navigate
      to="/"
      replace
      state={{ from: location }}
    />
  )
}