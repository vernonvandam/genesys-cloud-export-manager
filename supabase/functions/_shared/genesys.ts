export const supportedRegions = new Set([
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

export type VerifiedGenesysIdentity = {
  organizationId: string;
  organizationName: string;
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  region: string;
};

export async function verifyGenesysAccessToken(
  accessToken: string,
  requestedRegion: unknown,
): Promise<VerifiedGenesysIdentity> {
  if (typeof requestedRegion !== "string") {
    throw new Error("A Genesys Cloud region is required.");
  }
  const region = requestedRegion.trim().toLowerCase();
  if (!supportedRegions.has(region)) {
    throw new Error("The Genesys Cloud region is not supported.");
  }

  const root = `https://api.${region}/api/v2`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [userResponse, organizationResponse] = await Promise.all([
    fetch(`${root}/users/me`, { headers }),
    fetch(`${root}/organizations/me`, { headers }),
  ]);

  if (!userResponse.ok || !organizationResponse.ok) {
    throw new Error("Genesys Cloud could not verify the user and organization.");
  }

  const user: unknown = await userResponse.json();
  const organization: unknown = await organizationResponse.json();
  if (
    typeof user !== "object" || user === null ||
    typeof organization !== "object" || organization === null
  ) {
    throw new Error("Genesys Cloud returned incomplete identity details.");
  }
  const genesysUser = user as Record<string, unknown>;
  const genesysOrg = organization as Record<string, unknown>;
  if (
    typeof genesysUser.id !== "string" || !genesysUser.id ||
    typeof genesysOrg.id !== "string" || !genesysOrg.id
  ) {
    throw new Error("Genesys Cloud returned incomplete identity details.");
  }

  const username =
    typeof genesysUser.username === "string" ? genesysUser.username : null;
  const email = typeof genesysUser.email === "string" ? genesysUser.email : null;
  const name =
    typeof genesysUser.name === "string" && genesysUser.name.trim()
      ? genesysUser.name.trim()
      : username ?? email ?? genesysUser.id;
  const organizationName =
    typeof genesysOrg.name === "string" && genesysOrg.name.trim()
      ? genesysOrg.name.trim()
      : genesysOrg.id;

  return {
    organizationId: genesysOrg.id,
    organizationName,
    userId: genesysUser.id,
    name,
    username,
    email,
    region,
  };
}
