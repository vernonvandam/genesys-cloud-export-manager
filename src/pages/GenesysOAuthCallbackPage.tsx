import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AlertBlock } from "genesys-react-components";

import { useAuth } from "../auth/useAuth";
import { useSupabaseAuth } from "../auth/useSupabaseAuth";
import { linkCurrentGenesysIdentity } from "../lib/genesysIdentity";

export default function GenesysOAuthCallbackPage() {
  const {
    config,
    user: genesysUser,
    organization,
    status,
    error: genesysError,
  } = useAuth();

  const {
    user: appUser,
    loading: appLoading,
  } = useSupabaseAuth();

  const navigate = useNavigate();

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const attempted = useRef(false);

  useEffect(() => {
    if (appLoading || !appUser) return;

    if (status === "Authentication failed") return;

    if (status !== "Authenticated successfully") return;

    if (!genesysUser?.id || !organization?.id) {
      setLinkError(
        "Genesys authentication completed, but the user ID or organisation ID was not returned.",
      );
      return;
    }

    if (attempted.current) return;

    attempted.current = true;

    let active = true;

    setLinking(true);
    setLinkError("");

    void linkCurrentGenesysIdentity(config.region)
      .then(() => {
        if (active) {
          navigate("/app/settings", { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;

        setLinkError(
          error instanceof Error
            ? error.message
            : "Unable to link the Genesys identity.",
        );

        // Permit the user to retry the server-side link without
        // starting a new OAuth flow when the token is still valid.
        attempted.current = false;
      })
      .finally(() => {
        if (active) {
          setLinking(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    appLoading,
    appUser,
    config.region,
    genesysUser?.id,
    navigate,
    organization?.id,
    retryCount,
    status,
  ]);

  const oauthFailed = status === "Authentication failed";

  let message: ReactNode;

  if (appLoading) {
    message = "Checking your Export Manager session...";
  } else if (!appUser) {
    message =
      "Sign in to your Export Manager account before linking a Genesys identity.";
  } else if (oauthFailed) {
    message =
      genesysError ||
      "Genesys Cloud authentication failed. Return to Settings and try again.";
  } else if (linkError) {
    message = linkError;
  } else if (linking) {
    message =
      "Authentication succeeded. Verifying your Genesys identity and linking it to your Export Manager account...";
  } else {
    message =
      "Completing Genesys Cloud authentication. Please wait...";
  }

  const hasFailure =
    (!appLoading && !appUser) ||
    oauthFailed ||
    Boolean(linkError);

  return (
    <div className="genesys-app genesys-app-light auth-page">
      <main className="auth-card">
        <header className="auth-heading">
          <div>
            <p className="eyebrow">GENESYS CLOUD AUTHENTICATION</p>
            <h1 className="auth-title">
              Linking your Genesys identity
            </h1>
          </div>
        </header>

        <AlertBlock
          alertType={hasFailure ? "critical" : "info"}
          title={
            hasFailure
              ? "Authentication or linking failed"
              : "Please wait"
          }
          className="auth-status"
        >
          {message}
        </AlertBlock>

        {linkError &&
          appUser &&
          status === "Authenticated successfully" && (
            <div className="auth-actions">
              <button
                type="button"
                className="auth-submit"
                disabled={linking}
                onClick={() => {
                  attempted.current = false;
                  setRetryCount((count) => count + 1);
                }}
              >
                Retry identity linking
              </button>
            </div>
          )}

        <div className="auth-actions">
          {appUser ? (
            <Link to="/app/settings" className="auth-back-link">
              Return to Settings
            </Link>
          ) : (
            <Link to="/login/email" className="auth-back-link">
              Sign in to Export Manager
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}