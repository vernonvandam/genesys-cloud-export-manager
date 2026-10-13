import { Navigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { AlertBlock } from 'genesys-react-components'

import { isIntegratedIdentityError } from '../auth/supabase-auth-context'
import { useSupabaseAuth } from '../auth/useSupabaseAuth'

export default function SupabaseCallbackPage() {
  const [signOutError, setSignOutError] = useState('')
  const {
    user,
    loading,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
    signOut,
  } = useSupabaseAuth()

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Unable to sign out.',
      )
    }
  }

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
    const integratedIdentity = isIntegratedIdentityError(profileError)

    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <AlertBlock
            alertType="critical"
            title={
              integratedIdentity
                ? 'Use Genesys Cloud sign-in'
                : 'Unable to load your profile'
            }
          >
            {integratedIdentity
              ? 'This email is registered for Genesys-integrated access and cannot be used for standalone email sign-in. Sign out, then reopen Export Manager from your Genesys Cloud organization.'
              : profileError}
          </AlertBlock>

          {signOutError && (
            <AlertBlock alertType="critical" title="Sign-out failed">
              {signOutError}
            </AlertBlock>
          )}
          <button
            type="button"
            className="auth-submit"
            onClick={() =>
              void (integratedIdentity ? handleSignOut() : refreshProfile())
            }
          >
            {integratedIdentity ? 'Sign out' : 'Retry'}
          </button>
        </main>
      </div>
    )
  }

  return (
    <Navigate
      to={profile?.approval_status === 'approved' ? '/app' : '/access-pending'}
      replace
    />
  )
}