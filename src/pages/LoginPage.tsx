import { Link, Navigate } from 'react-router-dom'
import {
  AlertBlock,
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'

export default function LoginPage() {
  const {
    mode,
    config,
    user,
    status,
    error,
    isBusy,
    login,
  } = useAuth()

  const params = new URLSearchParams(
    window.location.search,
  )

  const isOAuthCallback =
    params.has('code') || params.has('error')

  const hasError =
    Boolean(error) ||
    status === 'Authentication failed' ||
    status === 'Configuration missing'

  if (user) {
    return <Navigate to="/app" replace />
  }

  const isIntegrated =
    mode === 'integrated' &&
    Boolean(
      config.clientId &&
      config.region &&
      config.redirectUri,
    )

  const statusMessage =
    error ||
    (status === 'Connecting to Genesys Cloud...'
      ? 'Continue the sign-in process in Genesys Cloud.'
      : status === 'Loading user details...'
        ? 'Verifying your Genesys Cloud identity and organisation.'
        : 'Your launch configuration is ready. Select Login to continue.')

  // Callback: the authentication provider will process the code.
  if (isOAuthCallback) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <header className="auth-heading">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppShieldCheck}
              className="auth-brand-icon"
            />
            <div>
              <p className="eyebrow">
                GENESYS CLOUD WORKSPACE
              </p>
              <h1 className="auth-title">
                Genesys Cloud Export Manager
              </h1>
            </div>
          </header>

          <h2 className="auth-subtitle">
            Completing sign-in
          </h2>

          <AlertBlock
            alertType={hasError ? 'critical' : 'info'}
            title={status}
            className="auth-status"
          >
            {statusMessage}
          </AlertBlock>
        </main>
      </div>
    )
  }

  // Complete integrated launch: show one login button.
  if (isIntegrated) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <header className="auth-heading">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppShieldCheck}
              className="auth-brand-icon"
            />
            <div>
              <p className="eyebrow">
                GENESYS CLOUD WORKSPACE
              </p>
              <h1 className="auth-title">
                Genesys Cloud Export Manager
              </h1>
            </div>
          </header>

          <h2 className="auth-subtitle">
            Sign in to your Genesys Cloud workspace
          </h2>

          <p className="auth-description">
            Your organisation connection has been provided.
            Continue to authenticate and open your workspace.
          </p>

          {hasError && (
            <AlertBlock
              alertType="critical"
              title={status}
              className="auth-status"
            >
              {statusMessage}
            </AlertBlock>
          )}

          <div className="auth-actions">
            <DxButton
              type="primary"
              disabled={isBusy}
              onClick={() => void login()}
            >
              {isBusy
                ? 'Connecting...'
                : hasError
                  ? 'Retry Genesys login'
                  : 'Login with Genesys Cloud'}
            </DxButton>
          </div>
        </main>
      </div>
    )
  }

  // Standalone entry: no general-purpose login button.
  return (
    <div className="genesys-app genesys-app-light auth-page">
      <main className="auth-card">
        <header className="auth-heading">
          <GenesysDevIcon
            icon={GenesysDevIcons.AppShieldCheck}
            className="auth-brand-icon"
          />
          <div>
            <p className="eyebrow">
              GENESYS CLOUD TOOLS
            </p>
            <h1 className="auth-title">
              Genesys Cloud Export Manager
            </h1>
          </div>
        </header>

        <h2 className="auth-subtitle">
          Sign in to your workspace
        </h2>

        <p className="auth-description">
          Choose how you would like to access Export Manager.
        </p>

        {hasError && (
          <AlertBlock
            alertType="critical"
            title={status}
            className="auth-status"
          >
            {statusMessage}
          </AlertBlock>
        )}

        <div className="auth-choice-list">
          <Link
            to="/login/genesys"
            className="auth-choice"
          >
            <span className="auth-choice-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppShieldCheck}
              />
            </span>

            <span className="auth-choice-copy">
              <span className="auth-choice-title">
                Connect to Genesys Cloud
              </span>
              <span className="auth-choice-description">
                Enter the connection details for your
                Genesys Cloud organisation.
              </span>
            </span>

            <span className="auth-choice-arrow">›</span>
          </Link>

          <Link
            to="/login/email"
            className="auth-choice"
          >
            <span className="auth-choice-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppUserSolid}
              />
            </span>

            <span className="auth-choice-copy">
              <span className="auth-choice-title">
                Sign in with email
              </span>
              <span className="auth-choice-description">
                Access Export Manager without connecting
                a Genesys organisation.
              </span>
            </span>

            <span className="auth-choice-arrow">›</span>
          </Link>
        </div>

        <p className="auth-help">
          Genesys features require a connected organisation.
        </p>
      </main>
    </div>
  )
}