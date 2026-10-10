import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Link,
  Navigate,
} from 'react-router-dom'
import { AlertBlock } from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'

export default function GenesysSetupPage() {
  const {
    config,
    user,
    status,
    error,
    isBusy,
    startGenesysLogin,
  } = useAuth()

  const [clientId, setClientId] =
    useState(config.clientId)

  const [region, setRegion] =
    useState(config.region)

  const [redirectUri, setRedirectUri] =
    useState(config.redirectUri)

  if (user) {
    return <Navigate to="/app" replace />
  }

  const hasError =
    Boolean(error) ||
    status === 'Authentication failed' ||
    status === 'Configuration missing'

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    await startGenesysLogin({
      clientId: clientId.trim(),
      region: region.trim(),
      redirectUri: redirectUri.trim(),
    })
  }

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
              ORGANISATION SETUP
            </p>

            <h1 className="auth-title">
              Connect Genesys Cloud
            </h1>
          </div>
        </header>

        <h2 className="auth-subtitle">
          Configure your connection
        </h2>

        <p className="auth-description">
          Enter the OAuth client details for the
          organisation you want to connect.
        </p>

        {hasError && (
          <AlertBlock
            alertType="critical"
            title={status}
            className="auth-status"
          >
            {error ||
              'Check the connection details and try again.'}
          </AlertBlock>
        )}

        {isBusy && (
          <AlertBlock
            alertType="info"
            title={status}
            className="auth-status"
          >
            Complete the sign-in process in Genesys Cloud.
          </AlertBlock>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label className="auth-field">
            <span>Client ID</span>

            <input
              className="auth-input"
              name="clientId"
              type="text"
              autoComplete="off"
              value={clientId}
              onChange={(event) =>
                setClientId(event.target.value)
              }
              placeholder="Genesys OAuth client ID"
              required
            />
          </label>

          <label className="auth-field">
            <span>Region / API domain</span>

            <input
              className="auth-input"
              name="region"
              type="text"
              autoComplete="url"
              value={region}
              onChange={(event) =>
                setRegion(event.target.value)
              }
              placeholder="mypurecloud.com.au"
              required
            />

            <span className="auth-field-help">
              Enter the Genesys region value used by
              the application.
            </span>
          </label>

          <label className="auth-field">
            <span>Redirect URI</span>

            <input
              className="auth-input"
              name="redirectUri"
              type="url"
              autoComplete="url"
              value={redirectUri}
              onChange={(event) =>
                setRedirectUri(event.target.value)
              }
              placeholder={`${window.location.origin}/`}
              required
            />

            <span className="auth-field-help">
              The URI must be registered on the Genesys
              OAuth client and return to this application.
            </span>
          </label>

          <button
            className="auth-submit"
            type="submit"
            disabled={isBusy}
          >
            {isBusy
              ? 'Connecting...'
              : 'Continue with Genesys Cloud'}
          </button>
        </form>

        <Link to="/" className="auth-back-link">
          Back to sign-in options
        </Link>
      </main>
    </div>
  )
}