import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertBlock } from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useSupabaseAuth } from '../auth/useSupabaseAuth'

export default function StandaloneOnboardingPage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
    profileError,
    saveProfile,
    refreshProfile,
  } = useSupabaseAuth()

  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setCompanyName(profile.company_name || '')
    }
  }, [profile])

  if (loading || (user && profileLoading)) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">
            Loading your account
          </h1>
        </main>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login/email" replace />
  }

  if (profile?.onboarding_completed) {
    return <Navigate to="/app" replace />
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError('')

    if (!displayName.trim()) {
      setFormError('Enter your name to continue.')
      return
    }

    setSaving(true)

    try {
      await saveProfile(
        displayName.trim(),
        companyName.trim(),
      )

      navigate('/app', { replace: true })
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to save your profile.',
      )
    } finally {
      setSaving(false)
    }
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
              ACCOUNT SETUP
            </p>

            <h1 className="auth-title">
              Welcome to Export Manager
            </h1>
          </div>
        </header>

        <h2 className="auth-subtitle">
          Tell us about yourself
        </h2>

        <p className="auth-description">
          Your email is verified. Complete your profile
          to open Export Manager. You can connect a
          Genesys Cloud organisation separately later.
        </p>

        <div className="config-list">
          <div className="config-row">
            <span className="config-label">
              Verified email
            </span>
            <span className="config-value">
              {user.email || 'Not available'}
            </span>
          </div>
        </div>

        {profileError && (
          <AlertBlock
            alertType="critical"
            title="Unable to load profile"
          >
            {profileError}
            <div>
              <button
                type="button"
                className="auth-back-link"
                onClick={() => void refreshProfile()}
              >
                Retry loading profile
              </button>
            </div>
          </AlertBlock>
        )}

        {formError && (
          <AlertBlock
            alertType="critical"
            title="Unable to complete onboarding"
          >
            {formError}
          </AlertBlock>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Your name</span>

            <input
              className="auth-input"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              placeholder="Your full name"
              required
            />
          </label>

          <label className="auth-field">
            <span>Company / business (optional)</span>

            <input
              className="auth-input"
              type="text"
              autoComplete="organization"
              maxLength={160}
              value={companyName}
              onChange={(event) =>
                setCompanyName(event.target.value)
              }
              placeholder="Your company or business name"
            />
          </label>

          <button
            className="auth-submit"
            type="submit"
            disabled={saving || Boolean(profileError)}
          >
            {saving
              ? 'Saving profile...'
              : 'Complete setup'}
          </button>
        </form>
      </main>
    </div>
  )
}