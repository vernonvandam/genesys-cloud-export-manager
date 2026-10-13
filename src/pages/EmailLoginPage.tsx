import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { supabase } from "../lib/supabaseClient";

export default function EmailLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeNotice, setCodeNotice] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: new URL(
            "/auth/callback",
            window.location.origin,
          ).toString(),
        },
      });

      if (authError) throw authError;

      setCodeSent(true);
      setCodeNotice(
        "If the address is associated with an approved account, Supabase will send a one-time code.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send the sign-in code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    setBusy(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: new URL(
            "/auth/callback",
            window.location.origin,
          ).toString(),
        },
      });
      if (authError) throw authError;
      setCodeNotice("A new code has been sent. Use the latest code from your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to resend the sign-in code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;
      navigate("/auth/callback", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to verify the sign-in code.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setCodeSent(false);
    setCode("");
    setCodeNotice("");
    setError("");
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
          Enter the email address associated with your approved account. New
          users must request access before signing in.
        </p>

        {error && (
          <AlertBlock
            alertType="critical"
            title={codeSent ? "Unable to verify sign-in code" : "Unable to send sign-in code"}
            className="auth-status"
          >
            {error}
          </AlertBlock>
        )}

        {codeSent && (
          <AlertBlock
            alertType="success"
            title="Check your email"
            className="auth-status"
          >
            {codeNotice}
          </AlertBlock>
        )}

        {!codeSent ? (
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
              {busy ? "Sending..." : "Email me a sign-in code"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerifyCode}>
            <label className="auth-field">
              <span>One-time code</span>
              <input
                className="auth-input"
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter the code from your email"
                required
              />
            </label>
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Verifying..." : "Verify code"}
            </button>
            <button
              className="tooling-secondary-button"
              type="button"
              onClick={() => void handleResendCode()}
              disabled={busy}
            >
              Resend code
            </button>
          </form>
        )}

        <div className="email-login-navigation">
          {codeSent && (
            <button
              className="tooling-secondary-button"
              type="button"
              onClick={changeEmail}
            >
              Change email address
            </button>
          )}

          <Link to="/" className="auth-back-link">
            Request access or return to sign-in
          </Link>
        </div>
      </main>
    </div>
  );
}
