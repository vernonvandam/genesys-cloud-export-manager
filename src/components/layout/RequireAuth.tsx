import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { useSupabaseAuth } from '../../auth/useSupabaseAuth'

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

function LoadingScreen({
  title = 'Loading your workspace',
}: {
  title?: string
}) {
  return (
    <div className="genesys-app genesys-app-light auth-page">
      <main className="auth-card">
        <h1 className="auth-title">{title}</h1>
        <p className="auth-description">
          Please wait while your session is verified.
        </p>
      </main>
    </div>
  )
}

export default function RequireAuth() {
  const {
    user: genesysUser,
    isBusy: genesysBusy,
    status: genesysStatus,
    error: genesysError,
  } = useAuth()

  const {
    user: standaloneUser,
    profile,
    loading: standaloneLoading,
    profileLoading,
    profileError,
    refreshProfile,
  } = useSupabaseAuth()

  const location = useLocation()
  const params = new URLSearchParams(location.search)

  const isOAuthCallback =
    params.has('code') || params.has('error')

  const isIntegratedLaunch =
    hasCompleteLaunchConfig(location.search)

  const genesysFailed =
    Boolean(genesysError) ||
    genesysStatus === 'Authentication failed' ||
    genesysStatus === 'Configuration missing'

  if (standaloneLoading) {
    return <LoadingScreen />
  }

  // Integrated Genesys authentication.
  if (genesysUser) {
    return <Outlet />
  }

  // Standalone Supabase authentication.
  if (standaloneUser) {
    if (profileLoading) {
      return <LoadingScreen title="Loading your profile" />
    }

    if (profileError) {
      return (
        <div className="genesys-app genesys-app-light auth-page">
          <main className="auth-card">
            <h1 className="auth-title">
              Unable to load your profile
            </h1>

            <p className="auth-description">
              Your email session is active, but Export
              Manager could not retrieve your profile.
            </p>

            <p>{profileError}</p>

            <button
              className="auth-submit"
              type="button"
              onClick={() => void refreshProfile()}
            >
              Retry
            </button>
          </main>
        </div>
      )
    }

    if (!profile?.onboarding_completed) {
      return (
        <Navigate to="/onboarding" replace />
      )
    }

    return <Outlet />
  }

  // Let an OAuth callback resolve before redirecting.
  if (isOAuthCallback && !genesysFailed) {
    return (
      <LoadingScreen title="Completing sign-in" />
    )
  }

  if (isOAuthCallback && genesysFailed) {
    return <Navigate to="/" replace />
  }

  // A direct dashboard URL with integrated launch
  // configuration must show the login button first.
  if (isIntegratedLaunch) {
    return (
      <Navigate
        to={`/${location.search}`}
        replace
      />
    )
  }

  if (genesysBusy) {
    return <LoadingScreen title="Connecting to Genesys Cloud" />
  }

  return (
    <Navigate
      to="/"
      replace
      state={{ from: location }}
    />
  )
}