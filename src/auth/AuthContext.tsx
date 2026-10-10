import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import platformClient from 'purecloud-platform-client-v2'

import { AuthContext } from './auth-context'

import type {
  GenesysConfig,
  GenesysUser,
} from '../types/app'

const CONFIG_KEY = 'genesys-app-config'

function getConfig(): GenesysConfig {
  const params = new URLSearchParams(
    window.location.search,
  )

  const fromUrl: Partial<GenesysConfig> = {
    clientId:
      params.get('clientId') ||
      params.get('gc_clientId') ||
      '',
    region:
      params.get('region') ||
      params.get('gc_region') ||
      '',
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
    redirectUri:
      fromUrl.redirectUri || saved.redirectUri || '',
  }

  if (
    config.clientId &&
    config.region &&
    config.redirectUri
  ) {
    try {
      // Store only non-secret launch configuration
      // across the OAuth redirect.
      sessionStorage.setItem(
        CONFIG_KEY,
        JSON.stringify(config),
      )
    } catch {
      // Continue if session storage is unavailable.
    }
  }

  return config
}

function cleanOAuthCallbackUrl() {
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.hash}`,
  )
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [config] = useState<GenesysConfig>(() => getConfig())
  const [user, setUser] = useState<GenesysUser | null>(null)
  const [status, setStatus] = useState('Not authenticated')
  const [error, setError] = useState('')

  const callbackHandled = useRef(false)

  const login = useCallback(async () => {
    setError('')

    if (
      !config.clientId ||
      !config.region ||
      !config.redirectUri
    ) {
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

      cleanOAuthCallbackUrl()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err)

      setError(message)
      setStatus('Authentication failed')
    }
  }, [config])

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    )

    const oauthError = params.get('error')

    if (oauthError && !callbackHandled.current) {
      callbackHandled.current = true

      setStatus('Authentication failed')
      setError(
        params.get('error_description') || oauthError,
      )

      cleanOAuthCallbackUrl()
      return
    }

    // Prevent duplicate callback handling in React Strict Mode.
    if (
      params.has('code') &&
      !callbackHandled.current
    ) {
      callbackHandled.current = true
      void login()
    }
  }, [login])

  const isBusy =
    status === 'Connecting to Genesys Cloud...' ||
    status === 'Loading user details...'

  return (
    <AuthContext.Provider
      value={{
        config,
        user,
        status,
        error,
        isBusy,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}