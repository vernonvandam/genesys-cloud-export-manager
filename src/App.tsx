import { useEffect, useState } from 'react'
import platformClient from 'purecloud-platform-client-v2'
import {
  AlertBlock,
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import './App.scss'

type GenesysUser = {
  id?: string
  name?: string
  email?: string
}

type GenesysConfig = {
  clientId: string
  region: string
  redirectUri: string
}

const CONFIG_KEY = 'genesys-app-config'

function getConfig(): GenesysConfig {
  const params = new URLSearchParams(window.location.search)

  const fromUrl: Partial<GenesysConfig> = {
    clientId:
      params.get('clientId') || params.get('gc_clientId') || '',
    region:
      params.get('region') || params.get('gc_region') || '',
    redirectUri:
      params.get('redirectUri') ||
      params.get('redirectURI') ||
      params.get('gc_redirectUrl') ||
      '',
  }

  let saved: Partial<GenesysConfig> = {}

  try {
    saved = JSON.parse(
      sessionStorage.getItem(CONFIG_KEY) || '{}',
    )
  } catch {
    saved = {}
  }

  const config: GenesysConfig = {
    clientId: fromUrl.clientId || saved.clientId || '',
    region: fromUrl.region || saved.region || '',
    redirectUri: fromUrl.redirectUri || saved.redirectUri || '',
  }

  if (config.clientId && config.region && config.redirectUri) {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  return config
}

export default function App() {
  const [config] = useState<GenesysConfig>(() => getConfig())
  const [user, setUser] = useState<GenesysUser | null>(null)
  const [status, setStatus] = useState('Not authenticated')
  const [error, setError] = useState('')

  async function login() {
    setError('')

    if (!config.clientId || !config.region || !config.redirectUri) {
      setStatus('Configuration missing')
      setError(
        'Provide clientId, region and redirectUri as URL parameters.',
      )
      return
    }

    setStatus('Connecting to Genesys Cloud...')

    try {
      const apiClient = platformClient.ApiClient.instance
      apiClient.setEnvironment(config.region)

      await apiClient.loginPKCEGrant(
        config.clientId,
        config.redirectUri,
      )

      setStatus('Loading user details...')

      const usersApi = new platformClient.UsersApi()
      const currentUser =
        (await usersApi.getUsersMe()) as GenesysUser

      setUser(currentUser)
      setStatus('Authenticated successfully')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err)

      setError(message)
      setStatus('Authentication failed')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.has('code') || params.has('error')) {
      void login()
    }

    // Resume PKCE after redirect; preserve the existing login flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          ? 'Retrieving the authenticated user profile.'
          : 'Sign in to verify access to your Genesys Cloud organisation.')

  return (
    <div className="genesys-app genesys-app-light">
      <main className="auth-card">
        <header className="auth-heading">
          <GenesysDevIcon
            icon={GenesysDevIcons.AppShieldCheck}
            className="auth-brand-icon"
          />
          <div>
            <h1 className="auth-title">
              Genesys Cloud Export Manager
            </h1>
          </div>
        </header>

        <h2 className="auth-subtitle">Authentication</h2>

        <div className="config-list">
          <div className="config-row">
            <span className="config-label">Client ID</span>
            <span className="config-value">
              {config.clientId ? 'Configured' : 'Missing'}
            </span>
          </div>

          <div className="config-row">
            <span className="config-label">Region</span>
            <span className="config-value">
              {config.region || 'Missing'}
            </span>
          </div>

          <div className="config-row">
            <span className="config-label">Redirect URI</span>
            <span className="config-value">
              {config.redirectUri || 'Missing'}
            </span>
          </div>
        </div>

        <AlertBlock
          alertType={alertType}
          title={status}
          className="auth-status"
        >
          {statusMessage}
        </AlertBlock>

        {!user && (
          <div className="auth-actions">
            <DxButton
              type="primary"
              disabled={
                status === 'Connecting to Genesys Cloud...' ||
                status === 'Loading user details...'
              }
              onClick={() => void login()}
            >
              Login with Genesys Cloud
            </DxButton>
          </div>
        )}

        {!user && (
          <p className="auth-help">
            Authentication uses Authorization Code with PKCE.
            No client secret is required in this browser application.
          </p>
        )}

        {user && (
          <section className="auth-user">
            <div className="auth-user-heading">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppUserSolid}
                className="auth-user-icon"
              />
              <h3>Authenticated User</h3>
            </div>

            <div className="config-list">
              <div className="config-row">
                <span className="config-label">Name</span>
                <span className="config-value">
                  {user.name || 'Not provided'}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">Email</span>
                <span className="config-value">
                  {user.email || 'Not provided'}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">User ID</span>
                <span className="config-value">
                  {user.id || 'Not provided'}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}