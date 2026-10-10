import { Navigate } from 'react-router-dom'
import {
  AlertBlock,
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'
import ConfigRow from '../components/common/ConfigRow'

export default function LoginPage() {
  const {
    config,
    user,
    status,
    error,
    isBusy,
    login,
  } = useAuth()

  if (user) {
    return <Navigate to="/app" replace />
  }

  const alertType =
    status === 'Authenticated successfully'
      ? 'success'
      : status === 'Authentication failed' ||
          status === 'Configuration missing'
        ? 'critical'
        : 'info'

  const statusMessage =
    error ||
    (status === 'Authenticated successfully'
      ? 'Your Genesys Cloud identity was verified successfully.'
      : status === 'Connecting to Genesys Cloud...'
        ? 'Continue the sign-in process in Genesys Cloud.'
        : status === 'Loading user details...'
          ? 'Retrieving your authenticated user profile.'
          : 'Sign in to open your Genesys Cloud export workspace.')

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
          Connect to your Genesys Cloud organisation to
          manage configuration exports and backups.
        </p>

        <div className="config-list">
          <ConfigRow
            label="Client ID"
            value={config.clientId ? 'Configured' : 'Missing'}
          />
          <ConfigRow
            label="Region"
            value={config.region}
          />
          <ConfigRow
            label="Redirect URI"
            value={config.redirectUri}
          />
        </div>

        <AlertBlock
          alertType={alertType}
          title={status}
          className="auth-status"
        >
          {statusMessage}
        </AlertBlock>

        <div className="auth-actions">
          <DxButton
            type="primary"
            disabled={isBusy}
            onClick={() => void login()}
          >
            {isBusy
              ? 'Connecting...'
              : 'Login with Genesys Cloud'}
          </DxButton>
        </div>

        <p className="auth-help">
          Uses OAuth Authorization Code with PKCE.
          No client secret is required in this browser
          application.
        </p>
      </main>
    </div>
  )
}