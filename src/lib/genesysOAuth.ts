import type { AuthMode } from "../auth/auth-context";
import type {
  GenesysConfig,
  GenesysOrganization,
  GenesysUser,
} from "../types/app";

const PENDING_AUTHORIZATION_KEY = "genesys-cloud-pkce";

const SUPPORTED_REGIONS = new Set([
  "mypurecloud.com",
  "mypurecloud.ie",
  "mypurecloud.de",
  "mypurecloud.jp",
  "mypurecloud.com.au",
  "mypurecloud.ca",
  "usw2.pure.cloud",
  "use2.pure.cloud",
  "euw2.pure.cloud",
  "euc2.pure.cloud",
  "apne1.pure.cloud",
  "apne2.pure.cloud",
  "apse2.pure.cloud",
  "cac1.pure.cloud",
  "sae1.pure.cloud",
  "mec1.pure.cloud",
]);

export type PendingGenesysAuthorization = {
  state: string;
  verifier: string;
  configuration: GenesysConfig;
  mode: AuthMode;
};

function validateConfiguration(configuration: GenesysConfig): GenesysConfig {
  const clientId = configuration.clientId.trim();
  const region = configuration.region.trim().toLowerCase();
  const redirectUri = configuration.redirectUri.trim();

  if (!clientId || !region || !redirectUri) {
    throw new Error("Client ID, region and redirect URI are required.");
  }

  if (!SUPPORTED_REGIONS.has(region)) {
    throw new Error(
      `Unsupported Genesys Cloud region "${region}". Enter a valid Genesys Cloud region domain.`,
    );
  }

  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    throw new Error("The redirect URI must be a valid absolute URL.");
  }

  const isLocalHttp =
    redirect.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);

  if (
    (redirect.protocol !== "https:" && !isLocalHttp) ||
    redirect.origin !== window.location.origin ||
    redirect.username !== "" ||
    redirect.password !== ""
  ) {
    throw new Error(
      "The redirect URI must use HTTPS (HTTP is allowed on localhost) and the same origin as this app.",
    );
  }

  return { clientId, region, redirectUri };
}

export function matchesGenesysRedirect(configuration: GenesysConfig) {
  try {
    const redirect = new URL(configuration.redirectUri);
    const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

    return (
      redirect.origin === window.location.origin &&
      normalizePath(redirect.pathname) ===
        normalizePath(window.location.pathname)
    );
  } catch {
    return false;
  }
}

export function getPendingAuthorization():
  | PendingGenesysAuthorization
  | null {
  const saved = sessionStorage.getItem(PENDING_AUTHORIZATION_KEY);
  if (!saved) return null;

  try {
    const parsed: unknown = JSON.parse(saved);
    if (
      isPendingAuthorization(parsed) &&
      matchesGenesysRedirect(parsed.configuration)
    ) {
      return parsed;
    }
  } catch {
    sessionStorage.removeItem(PENDING_AUTHORIZATION_KEY);
    return null;
  }

  sessionStorage.removeItem(PENDING_AUTHORIZATION_KEY);
  return null;
}

export function clearPendingAuthorization() {
  sessionStorage.removeItem(PENDING_AUTHORIZATION_KEY);
}

export async function beginAuthorization(
  configuration: GenesysConfig,
  mode: AuthMode,
) {
  const validatedConfiguration = validateConfiguration(configuration);
  const verifier = randomUrlSafeString(64);
  const state = randomUrlSafeString(32);
  const challenge = await createCodeChallenge(verifier);
  const pending: PendingGenesysAuthorization = {
    state,
    verifier,
    configuration: validatedConfiguration,
    mode,
  };

  sessionStorage.setItem(
    PENDING_AUTHORIZATION_KEY,
    JSON.stringify(pending),
  );

  const authorizeUrl = new URL(
    `https://login.${validatedConfiguration.region}/oauth/authorize`,
  );
  authorizeUrl.search = new URLSearchParams({
    client_id: validatedConfiguration.clientId,
    redirect_uri: validatedConfiguration.redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  }).toString();

  window.location.assign(authorizeUrl);
}

export async function completeAuthorization(
  code: string,
  pending: PendingGenesysAuthorization,
): Promise<string> {
  const response = await fetch(
    `https://login.${pending.configuration.region}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: pending.configuration.clientId,
        code,
        redirect_uri: pending.configuration.redirectUri,
        code_verifier: pending.verifier,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Genesys Cloud token exchange failed (${response.status} ${response.statusText}). Check the OAuth client, redirect URI and region.`,
    );
  }

  const tokenResponse: unknown = await response.json();
  if (
    typeof tokenResponse !== "object" ||
    tokenResponse === null ||
    !("access_token" in tokenResponse) ||
    typeof tokenResponse.access_token !== "string" ||
    !tokenResponse.access_token
  ) {
    throw new Error("Genesys Cloud returned an invalid token response.");
  }

  return tokenResponse.access_token;
}

export async function getCurrentGenesysDetails(
  configuration: GenesysConfig,
  accessToken: string,
): Promise<{ user: GenesysUser; organization: GenesysOrganization }> {
  const apiRoot = `https://api.${configuration.region}/api/v2`;
  const headers = { Authorization: `Bearer ${accessToken}` };

  const userResponse = await fetch(`${apiRoot}/users/me`, { headers });
  if (!userResponse.ok) {
    throw new Error(
      `Could not load your Genesys Cloud user profile (${userResponse.status} ${userResponse.statusText}). Verify the OAuth client has the users:readonly scope.`,
    );
  }

  const user = (await userResponse.json()) as GenesysUser;
  if (!user?.id || (!user.name && !user.email)) {
    throw new Error("Genesys Cloud returned an incomplete user profile.");
  }

  const organizationResponse = await fetch(`${apiRoot}/organizations/me`, {
    headers,
  });
  if (!organizationResponse.ok) {
    throw new Error(
      `Could not load your Genesys Cloud organization (${organizationResponse.status} ${organizationResponse.statusText}). Verify the OAuth client has the organizations:readonly scope.`,
    );
  }

  const organization =
    (await organizationResponse.json()) as GenesysOrganization;
  if (!organization?.id) {
    throw new Error("Genesys Cloud returned an incomplete organization.");
  }

  return { user, organization };
}

function isPendingAuthorization(
  value: unknown,
): value is PendingGenesysAuthorization {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<PendingGenesysAuthorization>;
  return (
    typeof candidate.state === "string" &&
    typeof candidate.verifier === "string" &&
    typeof candidate.configuration === "object" &&
    candidate.configuration !== null &&
    typeof candidate.configuration.clientId === "string" &&
    typeof candidate.configuration.region === "string" &&
    typeof candidate.configuration.redirectUri === "string" &&
    (candidate.mode === "integrated" || candidate.mode === "standalone")
  );
}

function randomUrlSafeString(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return encodeBase64Url(bytes);
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
