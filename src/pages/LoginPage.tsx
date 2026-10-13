import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  AlertBlock,
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'
import { useSupabaseAuth } from '../auth/useSupabaseAuth'
import { supabase } from '../lib/supabaseClient'

export default function LoginPage() {
  const navigate = useNavigate()
  const {
    mode,
    config,
    user,
    status,
    error,
    isBusy,
    login,
  } = useAuth()

  const {
    user: standaloneUser,
    profile: standaloneProfile,
    loading: standaloneLoading,
    profileLoading: standaloneProfileLoading,
  } = useSupabaseAuth()
  const [requestAccessOpen, setRequestAccessOpen] = useState(false)
  const [requestNotice, setRequestNotice] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestCodeSent, setRequestCodeSent] = useState(false)
  const [requestEmail, setRequestEmail] = useState('')
  const [requestCode, setRequestCode] = useState('')

  const params = new URLSearchParams(
    window.location.search,
  )

  const isOAuthCallback =
    params.has('code') || params.has('error')

  const isIntegrated =
    mode === 'integrated' &&
    Boolean(
      config.clientId &&
      config.region &&
      config.redirectUri,
    )

  const hasError =
    Boolean(error) ||
    status === 'Authentication failed' ||
    status === 'Configuration missing'

  const statusMessage =
    error ||
    (status === 'Connecting to Genesys Cloud...'
      ? 'Continue the sign-in process in Genesys Cloud.'
      : status === 'Loading user details...'
        ? 'Verifying your Genesys Cloud identity and organisation.'
        : 'Your launch configuration is ready. Select Login to continue.')

  // An authenticated Genesys user can access the dashboard.
  if (user) {
    return <Navigate to="/app" replace />
  }

  // The authentication provider processes OAuth callbacks.
  // Do not redirect or show the normal login choices first.
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

  // Integrated launch: show only the Genesys login button.
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

          <div className="auth-actions auth-actions-centered">
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

  // Standalone login: wait until the existing Supabase session
  // has been checked before deciding whether to show login choices.
  if (
    standaloneLoading ||
    (standaloneUser && standaloneProfileLoading)
  ) {
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
            Checking your session
          </h2>

          <AlertBlock
            alertType="info"
            title="Please wait"
            className="auth-status"
          >
            Checking your account and loading your profile.
          </AlertBlock>
        </main>
      </div>
    )
  }

  // A returning email user does not need to sign in again.
  // Send them to onboarding if their profile is incomplete.
  if (standaloneUser) {
    return (
      <Navigate
        to={
          standaloneProfile?.approval_status === 'approved'
            ? '/app'
            : '/access-pending'
        }
        replace
      />
    )
  }

  async function handleRequestAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestNotice('')
    setRequestError('')
    setRequestBusy(true)

    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('name') || '').trim()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const organizationId = String(form.get('organization_id') || '').trim()
    const message = String(form.get('message') || '').trim()

    try {
      const requestResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-access`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            display_name: displayName,
            email,
            organization_id: organizationId,
            message,
          }),
        },
      )
      const requestResult: unknown = await requestResponse.json()
      if (!requestResponse.ok) {
        const message =
          typeof requestResult === 'object' &&
          requestResult !== null &&
          'error' in requestResult &&
          typeof requestResult.error === 'string'
            ? requestResult.error
            : 'Unable to submit your access request.'
        throw new Error(message)
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: new URL(
            '/auth/callback',
            window.location.origin,
          ).toString(),
          data: { display_name: displayName },
        },
      })
      if (signInError) throw signInError

      setRequestEmail(email)
      setRequestCode('')
      setRequestCodeSent(true)
      setRequestNotice(
        'Your request has been received. Enter the one-time code sent to your email to verify your address. Workspace access will remain unavailable until an administrator approves your request.',
      )
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Unable to submit your access request.',
      )
    } finally {
      setRequestBusy(false)
    }
  }

  async function handleRequestCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError('')
    setRequestBusy(true)

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: requestEmail,
        token: requestCode.trim(),
        type: 'email',
      })
      if (verifyError) throw verifyError
      navigate('/auth/callback', { replace: true })
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Unable to verify the email code.',
      )
    } finally {
      setRequestBusy(false)
    }
  }

  async function handleResendRequestCode() {
    setRequestError('')
    setRequestBusy(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: requestEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: new URL(
            '/auth/callback',
            window.location.origin,
          ).toString(),
        },
      })
      if (signInError) throw signInError
      setRequestNotice(
        'A new one-time code has been sent. Use the latest code from your email.',
      )
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Unable to resend the email code.',
      )
    } finally {
      setRequestBusy(false)
    }
  }

  // No existing session or integrated launch: show the product landing page.
  return (
    <div className="genesys-app genesys-app-light marketing-page">
      <header className="marketing-header">
        <Link to="/" className="marketing-brand">
          <span className="marketing-brand-icon">
            <GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} />
          </span>
          <span>Genesys Cloud <strong>Export Manager</strong></span>
        </Link>
        <Link to="/login/email" className="marketing-header-link">
          Sign in
        </Link>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-copy">
            <p className="eyebrow">CONFIGURATION MANAGEMENT</p>
            <h1 className="marketing-title">
              Your Genesys Cloud configuration, <span>in view.</span>
            </h1>
            <p className="marketing-description">
              Explore a clearer way to organise configuration exports,
              review activity, and prepare backups for your Genesys Cloud
              environment.
            </p>

            {hasError && (
              <AlertBlock alertType="critical" title={status}>
                {statusMessage}
              </AlertBlock>
            )}

            <div className="marketing-actions">
              <Link to="/login/email" className="marketing-primary-button">
                Sign in with email
                <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                className="marketing-secondary-button"
                onClick={() => {
                  setRequestNotice('')
                  setRequestAccessOpen((open) => !open)
                }}
                aria-expanded={requestAccessOpen}
                aria-controls="request-access-form"
              >
                {requestAccessOpen ? 'Close request form' : 'Request access'}
              </button>
            </div>
            <p className="marketing-login-note">
              Already onboarded? Sign in with the email address associated
              with your account.
            </p>

            {requestAccessOpen && (
              <form
                id="request-access-form"
                className="request-access-form"
                onSubmit={
                  requestCodeSent
                    ? handleRequestCodeSubmit
                    : handleRequestAccessSubmit
                }
              >
                <div>
                  <p className="eyebrow">GET STARTED</p>
                  <h2>{requestCodeSent ? 'Verify your email' : 'Request access'}</h2>
                  <p>
                    {requestCodeSent
                      ? `Enter the one-time code sent to ${requestEmail}.`
                      : 'Submit your details and your Genesys Cloud home organization ID.'}
                  </p>
                </div>
                {requestCodeSent ? (
                  <>
                    <label className="auth-field">
                      <span>One-time code</span>
                      <input
                        className="auth-input"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={8}
                        value={requestCode}
                        onChange={(event) => setRequestCode(event.target.value)}
                        placeholder="Enter the code from your email"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="marketing-primary-button"
                      disabled={requestBusy}
                    >
                      {requestBusy ? 'Verifying...' : 'Verify email'}
                      <span aria-hidden="true">→</span>
                    </button>
                    <button
                      type="button"
                      className="marketing-secondary-button"
                      onClick={() => void handleResendRequestCode()}
                      disabled={requestBusy}
                    >
                      Resend code
                    </button>
                  </>
                ) : (
                  <>
                    <label className="auth-field">
                      <span>Your name</span>
                      <input
                        className="auth-input"
                        name="name"
                        autoComplete="name"
                        placeholder="Full name"
                        required
                      />
                    </label>
                    <label className="auth-field">
                      <span>Work email</span>
                      <input
                        className="auth-input"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        required
                      />
                    </label>
                    <label className="auth-field">
                      <span>Genesys Cloud organization ID</span>
                      <input
                        className="auth-input"
                        name="organization_id"
                        placeholder="Genesys Cloud organization ID"
                        required
                      />
                    </label>
                    <label className="auth-field">
                      <span>Anything we should know? <small>(optional)</small></span>
                      <textarea
                        className="auth-input request-access-message"
                        name="message"
                        rows={3}
                        placeholder="Tell us briefly how you plan to use Export Manager"
                      />
                    </label>
                    <button
                      type="submit"
                      className="marketing-primary-button"
                      disabled={requestBusy}
                    >
                      {requestBusy ? 'Submitting...' : 'Submit request'}
                      <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}
                {requestError && (
                  <AlertBlock
                    alertType="critical"
                    title={
                      requestCodeSent
                        ? 'Email verification failed'
                        : 'Request not submitted'
                    }
                  >
                    {requestError}
                  </AlertBlock>
                )}
                {requestNotice && (
                  <AlertBlock
                    alertType="success"
                    title={requestCodeSent ? 'Check your email' : 'Request submitted'}
                  >
                    {requestNotice}
                  </AlertBlock>
                )}
              </form>
            )}
          </div>

          <div className="marketing-preview-wrap">
            <div className="marketing-preview-glow" aria-hidden="true" />
            <div
              className="marketing-preview"
              role="img"
              aria-label="Illustrative preview of the Export Manager overview page"
            >
              <div className="preview-window-bar">
                <span /><span /><span />
                <div>Genesys Cloud Export Manager</div>
              </div>
              <div className="preview-app">
                <aside className="preview-sidebar">
                  <div className="preview-sidebar-brand">
                    <span><GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} /></span>
                    <div><b>Genesys Cloud</b><small>Export Manager</small></div>
                  </div>
                  <div className="preview-org"><i /> Connected to Example Org</div>
                  <small className="preview-nav-label">WORKSPACE</small>
                  <div className="preview-nav-item preview-nav-active">▦ <span>Overview</span></div>
                  <div className="preview-nav-item">◇ <span>Resources</span></div>
                  <div className="preview-nav-item">▤ <span>Export history</span></div>
                  <div className="preview-nav-item">⚙ <span>Settings</span></div>
                  <div className="preview-sidebar-user"><i>JD</i><span>Jordan Davis<small>Export Manager</small></span></div>
                </aside>
                <div className="preview-content">
                  <div className="preview-topbar">
                    <div><small>WORKSPACE / OVERVIEW</small><b>Your export workspace</b></div>
                    <span><i /> Connected</span>
                  </div>
                  <div className="preview-workspace">
                    <div className="preview-welcome">
                      <small>WELCOME BACK</small>
                      <b>Hello, Jordan</b>
                      <span>Review activity and manage your Genesys Cloud configuration.</span>
                      <em>＋ Start a new export</em>
                    </div>
                    <div className="preview-connection"><i>✓</i><span><b>Connected to Example Org</b><small>Authenticated as jordan.davis@example.com</small></span><small>mypurecloud.com</small></div>
                    <div className="preview-metrics">
                      <div><small>EXPORT RUNS THIS MONTH</small><b>12</b><i>↻</i></div>
                      <div><small>COMPLETED</small><b>10</b><i className="preview-green">✓</i></div>
                      <div><small>DRAFTS / PLANNED</small><b>2</b><i className="preview-amber">▤</i></div>
                      <div><small>RESOURCE GROUPS</small><b>4</b><i>⌘</i></div>
                    </div>
                    <div className="preview-section-title"><b>Export workflows</b><small>View all resources&nbsp; ›</small></div>
                    <div className="preview-workflow">
                      <i>⌘</i><span><b>Configuration export &amp; backup</b><small>Collect supported configuration and prepare a backup package.</small></span><em>Open workspace&nbsp; →</em>
                    </div>
                    <div className="preview-history"><b>Recent activity</b><span>Configuration backup <i>Completed</i></span><span>Configuration snapshot <i>Completed</i></span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-caption">
              <span><i /> ILLUSTRATIVE PREVIEW</span>
              <small>Export Manager overview</small>
            </div>
          </div>
        </section>

        <section className="marketing-features" aria-label="Product highlights">
          <article><span>01</span><div><b>See the big picture</b><p>Keep export activity and workspace status easy to review.</p></div></article>
          <article><span>02</span><div><b>Organize your resources</b><p>Bring configuration groups and backup workflows together.</p></div></article>
          <article><span>03</span><div><b>Stay in control</b><p>Sign in with your account to access your workspace.</p></div></article>
        </section>
      </main>

      <footer className="marketing-footer">
        <span>GENESYS CLOUD EXPORT MANAGER</span>
        <span>Configuration visibility, made simpler.</span>
      </footer>
    </div>
  )
}