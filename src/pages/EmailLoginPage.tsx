import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { supabase } from "../lib/supabaseClient";

export default function EmailLoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setSent(false);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: new URL(
            "/auth/callback",
            window.location.origin,
          ).toString(),
        },
      });

      if (authError) throw authError;

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send the sign-in link.",
      );
    } finally {
      setBusy(false);
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
            <p className="eyebrow">EXPORT MANAGER ACCOUNT</p>

            <h1 className="auth-title">Sign in with email</h1>
          </div>
        </header>

        <h2 className="auth-subtitle">Access your workspace</h2>

        <p className="auth-description">
          Enter your email address. We'll send you a secure sign-in link. New
          users can create their account through the same process.
        </p>

        {error && (
          <AlertBlock
            alertType="critical"
            title="Unable to send sign-in link"
            className="auth-status"
          >
            {error}
          </AlertBlock>
        )}

        {sent && (
          <AlertBlock
            alertType="success"
            title="Check your email"
            className="auth-status"
          >
            If the address can be registered, Supabase will send a link to
            continue. Open the link in this browser to finish sign-in.
          </AlertBlock>
        )}

        {!sent && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email address</span>

              <input
                className="auth-input"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Email me a sign-in link"}
            </button>
          </form>
        )}

        <div className="email-login-navigation">
          {sent && (
            <button
              className="tooling-secondary-button"
              type="button"
              onClick={() => setSent(false)}
            >
              Try another email address
            </button>
          )}

          <Link to="/" className="auth-back-link">
            Back to sign-in options
          </Link>
        </div>
      </main>
    </div>
  );
}
