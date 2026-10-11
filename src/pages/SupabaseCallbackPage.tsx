import { Navigate, Link } from 'react-router-dom'
import { AlertBlock } from 'genesys-react-components'

import { useSupabaseAuth } from '../auth/useSupabaseAuth'

export default function SupabaseCallbackPage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
  } = useSupabaseAuth()

  if (loading || (user && profileLoading)) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">
            Verifying your email
          </h1>

          <p className="auth-description">
            Please wait while we complete your sign-in.
          </p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">
            Unable to complete sign-in
          </h1>

          <p className="auth-description">
            The link may have expired, already been used,
            or been opened in a different browser.
          </p>

          <Link
            to="/login/email"
            className="auth-back-link"
          >
            Request a new sign-in link
          </Link>
        </main>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <AlertBlock
            alertType="critical"
            title="Unable to load your profile"
          >
            {profileError}
          </AlertBlock>

          <button
            type="button"
            className="auth-submit"
            onClick={() => void refreshProfile()}
          >
            Retry
          </button>
        </main>
      </div>
    )
  }

  return (
    <Navigate
      to={
        profile?.onboarding_completed
          ? '/app'
          : '/onboarding'
      }
      replace
    />
  )
}