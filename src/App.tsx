import { useEffect, useState } from 'react'
import platformClient from 'purecloud-platform-client-v2'

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

  // Accept both plain parameter names and Genesys-style names.
  const fromUrl: Partial<GenesysConfig> = {
    clientId: params.get('clientId') || params.get('gc_clientId') || '',
    region: params.get('region') || params.get('gc_region') || '',
    redirectUri:
      params.get('redirectUri') ||
      params.get('redirectURI') ||
      params.get('gc_redirectUrl') ||
      '',
  }

  // Retain non-secret configuration across the OAuth redirect.
  let saved: Partial<GenesysConfig> = {}

  try {
    saved = JSON.parse(sessionStorage.getItem(CONFIG_KEY) || '{}')
  } catch {
    saved = {}
  }

  const config: GenesysConfig = {
    clientId: fromUrl.clientId || saved.clientId || '',
    region: fromUrl.region || saved.region || '',
    redirectUri: fromUrl.redirectUri || saved.redirectUri || '',
  }

  // Save configuration only when all required values are available.
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

    // Run on initial page load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main style={{ maxWidth: 720, margin: '60px auto', padding: 24 }}>
      <h1>Genesys Cloud Export Manager</h1>
      <h2>Authentication</h2>

      <p>
        <strong>Client ID:</strong>{' '}
        {config.clientId ? 'Configured' : 'Missing'}
      </p>
      <p>
        <strong>Region:</strong>{' '}
        {config.region || 'Missing'}
      </p>
      <p>
        <strong>Redirect URI:</strong>{' '}
        {config.redirectUri || 'Missing'}
      </p>
      <p>
        <strong>Status:</strong> {status}
      </p>

      {!user && (
        <button
          onClick={() => void login()}
          disabled={status === 'Connecting to Genesys Cloud...'}
          style={{ padding: '10px 18px', cursor: 'pointer' }}
        >
          Login with Genesys Cloud
        </button>
      )}

      {user && (
        <section>
          <h3>Authenticated User</h3>
          <p><strong>Name:</strong> {user.name || 'Not provided'}</p>
          <p><strong>Email:</strong> {user.email || 'Not provided'}</p>
          <p><strong>User ID:</strong> {user.id || 'Not provided'}</p>
        </section>
      )}

      {error && (
        <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      )}
    </main>
  )
}