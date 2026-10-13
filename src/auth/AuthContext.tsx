import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AuthContext, type AuthMode } from "./auth-context";
import {
  beginAuthorization,
  completeAuthorization,
  clearPendingAuthorization,
  getPendingAuthorization,
  getCurrentGenesysDetails,
  matchesGenesysRedirect,
  type PendingGenesysAuthorization,
} from "../lib/genesysOAuth";

import type {
  GenesysConfig,
  GenesysOrganization,
  GenesysUser,
} from "../types/app";

function getUrlConfig(): Partial<GenesysConfig> {
  const params = new URLSearchParams(window.location.search);

  return {
    clientId: params.get("clientId") || params.get("gc_clientId") || "",
    region: params.get("region") || params.get("gc_region") || "",
    redirectUri:
      params.get("redirectUri") ||
      params.get("redirectURI") ||
      params.get("gc_redirectUrl") ||
      "",
  };
}

function isCompleteConfig(
  config: Partial<GenesysConfig>,
): config is GenesysConfig {
  return Boolean(
    config.clientId?.trim() &&
      config.region?.trim() &&
      config.redirectUri?.trim(),
  );
}

function getInitialAuthState(): {
  config: GenesysConfig;
  mode: AuthMode;
  callback: boolean;
  pending: PendingGenesysAuthorization | null;
  callbackError: string;
} {
  const params = new URLSearchParams(window.location.search);
  const callback = params.has("code") || params.has("error");
  const urlConfig = getUrlConfig();
  let pending: PendingGenesysAuthorization | null = null;
  let callbackError = "";

  if (callback) {
    try {
      pending = getPendingAuthorization();
    } catch (error) {
      callbackError =
        error instanceof Error
          ? `Unable to resume Genesys sign-in: ${error.message}`
          : "Unable to resume Genesys sign-in because browser session storage is unavailable.";
    }

    if (!callbackError && pending && !matchesGenesysRedirect(pending.configuration)) {
      callbackError =
        "The Genesys sign-in response was returned to a different redirect URI. Please start sign-in again.";
    } else if (!callbackError && !pending) {
      callbackError =
        "The Genesys sign-in response could not be verified. Please start sign-in again.";
    }

    return {
      config: pending?.configuration ?? {
        clientId: urlConfig.clientId || "",
        region: urlConfig.region || "",
        redirectUri: urlConfig.redirectUri || "",
      },
      mode: pending?.mode ?? "standalone",
      callback,
      pending,
      callbackError,
    };
  }

  return {
    config: {
      clientId: urlConfig.clientId || "",
      region: urlConfig.region || "",
      redirectUri: urlConfig.redirectUri || "",
    },
    mode: isCompleteConfig(urlConfig) ? "integrated" : "standalone",
    callback,
    pending,
    callbackError,
  };
}

function cleanOAuthCallbackUrl() {
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.hash}`,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialState] = useState(getInitialAuthState);
  const { config, mode } = initialState;
  const [user, setUser] = useState<GenesysUser | null>(null);
  const [organization, setOrganization] =
    useState<GenesysOrganization | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState(
    initialState.callbackError ? "Authentication failed" : "Not authenticated",
  );
  const [error, setError] = useState(initialState.callbackError);

  const callbackHandled = useRef(false);

  const disconnectGenesys = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setOrganization(null);
    setError("");
    setStatus("Not authenticated");
  }, []);

  const login = useCallback(async () => {
    setError("");
    setStatus("Connecting to Genesys Cloud...");

    try {
      await beginAuthorization(config, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Authentication failed");
    }
  }, [config, mode]);

  useEffect(() => {
    if (!initialState.callback || callbackHandled.current) return;
    callbackHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    const pending = initialState.pending;

    clearPendingAuthorization();
    cleanOAuthCallbackUrl();

    if (initialState.callbackError || !pending) {
      setStatus("Authentication failed");
      setError(
        initialState.callbackError ||
          "The Genesys sign-in response could not be verified. Please start sign-in again.",
      );
      return;
    }

    if (params.get("state") !== pending.state) {
      setStatus("Authentication failed");
      setError(
        "The Genesys sign-in response could not be verified. Please start sign-in again.",
      );
      return;
    }

    if (oauthError) {
      setStatus("Authentication failed");
      setError(
        params.get("error_description") ||
          `Genesys Cloud authorization failed: ${oauthError}`,
      );
      return;
    }

    if (!code) {
      setStatus("Authentication failed");
      setError("Genesys Cloud did not return an authorization code.");
      return;
    }

    setError("");
    setStatus("Connecting to Genesys Cloud...");

    void completeAuthorization(code, pending)
      .then(async (token) => {
        setStatus("Loading user details...");
        const details = await getCurrentGenesysDetails(
          pending.configuration,
          token,
        );
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/genesys-auth`,
          {
            method: "POST",
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ region: pending.configuration.region }),
          },
        );
        const registered: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof registered === "object" &&
            registered !== null &&
            "error" in registered &&
            typeof registered.error === "string"
              ? registered.error
              : "Genesys Cloud identity could not be registered.";
          throw new Error(message);
        }
        if (
          typeof registered !== "object" ||
          registered === null ||
          !("user" in registered) ||
          !("organization" in registered)
        ) {
          throw new Error("The access service returned an invalid Genesys identity.");
        }

        setAccessToken(token);
        setUser(details.user);
        setOrganization(details.organization);
        setStatus("Authenticated successfully");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Authentication failed");
      });
  }, [initialState]);

  const isBusy =
    status === "Connecting to Genesys Cloud..." ||
    status === "Loading user details...";

  return (
    <AuthContext.Provider
      value={{
        config,
        mode,
        user,
        organization,
        accessToken,
        status,
        error,
        isBusy,
        login,
        disconnectGenesys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
