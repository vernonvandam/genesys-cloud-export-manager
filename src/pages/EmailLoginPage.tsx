import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertBlock } from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

export default function EmailLoginPage() {
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setNotice(
      'Email authentication is not configured yet. No email was sent. This form will be connected to Export Manager authentication.',
    )
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
              EXPORT MANAGER ACCOUNT
            </p>

            <h1 className="auth-title">
              Sign in with email
            </h1>
          </div>
        </header>

        <h2 className="auth-subtitle">
          Access your workspace
        </h2>

        <p className="auth-description">
          Use your Export Manager account. This sign-in
          does not connect a Genesys Cloud organisation.
        </p>

        {notice && (
          <AlertBlock
            alertType="info"
            title="Email sign-in not connected"
            className="auth-status"
          >
            {notice}
          </AlertBlock>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label className="auth-field">
            <span>Email address</span>

            <input
              className="auth-input"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@company.com"
              required
            />
          </label>

          <button
            className="auth-submit"
            type="submit"
          >
            Continue with email
          </button>
        </form>

        <Link to="/" className="auth-back-link">
          Back to sign-in options
        </Link>
      </main>
    </div>
  )
}