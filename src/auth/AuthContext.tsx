import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import platformClient from "purecloud-platform-client-v2";

import { AuthContext, type AuthMode } from "./auth-context";

import type {
  GenesysConfig,
  GenesysOrganization,
  GenesysUser,
} from "../types/app";

const CONFIG_KEY = "genesys-app-config";
const FLOW_MODE_KEY = "genesys-auth-flow-mode";

function isCompleteConfig(
  config: Partial<GenesysConfig>,
): config is GenesysConfig {
  return Boolean(
    config.clientId?.trim() &&
    config.region?.trim() &&
    config.redirectUri?.trim(),
  );
}

function matchesGenesysRedirectPath(config: Partial<GenesysConfig>) {
  if (!isCompleteConfig(config)) return false;

  try {
    const redirect = new URL(config.redirectUri);

    const normalisePath = (path: string) => path.replace(/\/+$/, "") || "/";

    return (
      redirect.origin === window.location.origin &&
      normalisePath(redirect.pathname) ===
        normalisePath(window.location.pathname)
    );
  } catch {
    return false;
  }
}

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

function readSavedConfig(): Partial<GenesysConfig> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CONFIG_KEY) || "{}");

    return {
      clientId: typeof saved.clientId === "string" ? saved.clientId : "",
      region: typeof saved.region === "string" ? saved.region : "",
      redirectUri:
        typeof saved.redirectUri === "string" ? saved.redirectUri : "",
    };
  } catch {
    return {};
  }
}

function saveAuthConfig(config: GenesysConfig, mode: AuthMode) {
  sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  sessionStorage.setItem(FLOW_MODE_KEY, mode);
}

function getInitialAuthState(): {
  config: GenesysConfig;
  mode: AuthMode;
} {
  const params = new URLSearchParams(window.location.search);

  const urlConfig = getUrlConfig();

  // A complete configuration means integrated launch.
  // Save it for the subsequent OAuth redirect callback.
  if (isCompleteConfig(urlConfig)) {
    try {
      saveAuthConfig(urlConfig, "integrated");
    } catch {
      // The login can start, but callback recovery
      // requires session storage to be available.
    }

    return {
      config: urlConfig,
      mode: "integrated",
    };
  }

  const isOAuthCallback = params.has("code") || params.has("error");

  if (isOAuthCallback) {
    const savedConfig = readSavedConfig();

    if (
      isCompleteConfig(savedConfig) &&
      matchesGenesysRedirectPath(savedConfig)
    ) {
      let savedMode: string | null = null;

      try {
        savedMode = sessionStorage.getItem(FLOW_MODE_KEY);
      } catch {
        savedMode = null;
      }

      return {
        config: savedConfig,
        mode: savedMode === "integrated" ? "integrated" : "standalone",
      };
    }
  }

  // Preserve partial URL values so the standalone
  // connection form can prefill any supplied fields.
  return {
    config: {
      clientId: urlConfig.clientId || "",
      region: urlConfig.region || "",
      redirectUri: urlConfig.redirectUri || "",
    },
    mode: "standalone",
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

  const [config, setConfig] = useState<GenesysConfig>(initialState.config);

  const [mode, setMode] = useState<AuthMode>(initialState.mode);

  const [user, setUser] = useState<GenesysUser | null>(null);

  const [organization, setOrganization] = useState<GenesysOrganization | null>(
    null,
  );

  const [status, setStatus] = useState("Not authenticated");

  const [error, setError] = useState("");

  const authInProgress = useRef(false);
  const callbackHandled = useRef(false);

  const authenticateWithConfig = useCallback(
    async (selectedConfig: GenesysConfig) => {
      if (authInProgress.current) return;

      setError("");

      if (!isCompleteConfig(selectedConfig)) {
        setStatus("Configuration missing");
        setError("Client ID, region and redirect URI are required.");
        return;
      }

      authInProgress.current = true;
      setStatus("Connecting to Genesys Cloud...");

      try {
        const apiClient = platformClient.ApiClient.instance;

        apiClient.setEnvironment(selectedConfig.region);

        // Normal PKCE redirect flow. No popup options.
        await apiClient.loginPKCEGrant(
          selectedConfig.clientId,
          selectedConfig.redirectUri,
        );

        setStatus("Loading user details...");

        const usersApi = new platformClient.UsersApi();

        const currentUser = (await usersApi.getUsersMe()) as GenesysUser;

        const organizationApi = new platformClient.OrganizationApi();

        const currentOrganization =
          (await organizationApi.getOrganizationsMe()) as GenesysOrganization;

        if (!currentOrganization?.id) {
          throw new Error(
            "Login succeeded, but the Genesys organisation could not be identified.",
          );
        }

        setUser(currentUser);
        setOrganization(currentOrganization);
        setStatus("Authenticated successfully");

        cleanOAuthCallbackUrl();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        setError(message);
        setStatus("Authentication failed");

        if (new URLSearchParams(window.location.search).has("code")) {
          cleanOAuthCallbackUrl();
        }
      } finally {
        authInProgress.current = false;
      }
    },
    [],
  );

  // Used by the login button and to finish an OAuth callback.
  const login = useCallback(async () => {
    await authenticateWithConfig(config);
  }, [authenticateWithConfig, config]);

  // Used by the standalone Genesys onboarding form.
  const startGenesysLogin = useCallback(
    async (selectedConfig: GenesysConfig) => {
      setError("");

      if (!isCompleteConfig(selectedConfig)) {
        setStatus("Configuration missing");
        setError("Client ID, region and redirect URI are required.");
        return;
      }

      try {
        saveAuthConfig(selectedConfig, "standalone");
      } catch {
        setStatus("Authentication failed");
        setError(
          "Could not save the connection settings needed to resume sign-in. Check browser session storage and try again.",
        );
        return;
      }

      setConfig(selectedConfig);
      setMode("standalone");

      await authenticateWithConfig(selectedConfig);
    },
    [authenticateWithConfig],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const isGenesysCallback =
      (params.has("code") || params.has("error")) &&
      matchesGenesysRedirectPath(config);

    if (!isGenesysCallback) return;

    const oauthError = params.get("error");

    if (oauthError) {
      if (!callbackHandled.current) {
        callbackHandled.current = true;

        setStatus("Authentication failed");
        setError(params.get("error_description") || oauthError);

        cleanOAuthCallbackUrl();
      }

      return;
    }

    // Process an OAuth callback, but do not auto-start a
    // fresh login just because launch parameters are present.
    if (params.has("code") && !callbackHandled.current) {
      callbackHandled.current = true;
      void login();
    }
  }, [login]);

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
        status,
        error,
        isBusy,
        login,
        startGenesysLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
