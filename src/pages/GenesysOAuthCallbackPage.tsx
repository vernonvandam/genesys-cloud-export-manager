import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AlertBlock } from "genesys-react-components";

import { useAuth } from "../auth/useAuth";

export default function GenesysOAuthCallbackPage() {
  const { status, error } = useAuth();
  const navigate = useNavigate();

  const authenticationFailed = status === "Authentication failed";
  const authenticated = status === "Authenticated successfully";

  useEffect(() => {
    if (authenticated) {
      navigate("/app/settings", { replace: true });
    }
  }, [authenticated, navigate]);

  return (
    <div className="genesys-app genesys-app-light auth-page">
      <main className="auth-card">
        <header className="auth-heading">
          <div>
            <p className="eyebrow">GENESYS CLOUD AUTHENTICATION</p>
            <h1 className="auth-title">Completing Genesys sign-in</h1>
          </div>
        </header>

        <AlertBlock
          alertType={authenticationFailed ? "critical" : "info"}
          title={authenticationFailed ? "Sign-in failed" : "Please wait"}
          className="auth-status"
        >
          {authenticationFailed
            ? error || "Genesys Cloud authentication failed."
            : status === "Loading user details..."
              ? "Loading your Genesys user and organization details..."
              : "Completing Genesys Cloud authentication..."}
        </AlertBlock>

        {authenticationFailed && (
          <div className="auth-actions">
            <Link to="/app/settings" className="auth-back-link">
              Return to Settings
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
