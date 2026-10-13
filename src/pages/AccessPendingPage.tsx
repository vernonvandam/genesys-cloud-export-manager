import { Navigate, Link } from "react-router-dom";
import { useState } from "react";
import { AlertBlock } from "genesys-react-components";

import { isIntegratedIdentityError } from "../auth/supabase-auth-context";
import { useSupabaseAuth } from "../auth/useSupabaseAuth";

export default function AccessPendingPage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
    signOut,
  } = useSupabaseAuth();
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
  }

  if (loading || (user && profileLoading)) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <h1 className="auth-title">Checking your access</h1>
        </main>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (profile?.approval_status === "approved") {
    return <Navigate to="/app" replace />;
  }

  const integratedIdentity = isIntegratedIdentityError(profileError);

  return (
    <div className="genesys-app genesys-app-light auth-page">
      <main className="auth-card">
        <p className="eyebrow">EXPORT MANAGER ACCESS</p>
        <h1 className="auth-title">
          {integratedIdentity
            ? "Use Genesys Cloud sign-in"
            : profile?.approval_status === "rejected"
              ? "Access request not approved"
              : "Your request is awaiting approval"}
        </h1>
        <p className="auth-description">
          {integratedIdentity
            ? "This email is registered for Genesys-integrated access and cannot be used for standalone email sign-in. Sign out, then reopen Export Manager from your Genesys Cloud organization."
            : profile?.approval_status === "rejected"
              ? "Your account does not currently have workspace access. Contact your Export Manager administrator if you believe this is incorrect."
              : "Your email is verified, but an administrator must approve your request before you can access the workspace."}
        </p>

        {profileError && !integratedIdentity && (
          <AlertBlock alertType="critical" title="Unable to check your request">
            {profileError}
          </AlertBlock>
        )}
        {signOutError && (
          <AlertBlock alertType="critical" title="Sign-out failed">
            {signOutError}
          </AlertBlock>
        )}

        <div className="auth-actions">
          {!integratedIdentity && (
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={() => void refreshProfile()}
            >
              Check approval status
            </button>
          )}
          <button
            type="button"
            className="auth-back-link"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
          <Link to="/" className="auth-back-link">
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
