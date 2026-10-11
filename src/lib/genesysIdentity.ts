import platformClient from "purecloud-platform-client-v2";

import { supabase } from "./supabaseClient";

type ApiClientWithOAuthToken = {
  authentications?: Record<
    string,
    {
      accessToken?: unknown;
    }
  >;
};

type LinkResponse = {
  ok?: boolean;
  error?: string;
  linked?: {
    genesysUserId: string;
    organizationId: string;
    username: string;
    email: string | null;
    region: string;
  };
};

export async function linkCurrentGenesysIdentity(
  region: string,
): Promise<void> {
  const apiClient =
    platformClient.ApiClient.instance as unknown as ApiClientWithOAuthToken;

  const accessToken =
    apiClient.authentications?.["PureCloud OAuth"]?.accessToken;

  if (
    typeof accessToken !== "string" ||
    accessToken.trim().length === 0
  ) {
    throw new Error(
      "No authenticated Genesys Cloud access token is available. Please try connecting again.",
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "link-genesys-identity",
    {
      body: {
        accessToken,
        region,
      },
    },
  );

  if (error) {
    throw new Error(
      `Unable to verify the Genesys identity: ${error.message}`,
    );
  }

  const result = data as LinkResponse | null;

  if (!result?.ok || !result.linked?.genesysUserId) {
    throw new Error(
      result?.error ||
        "The Genesys identity could not be linked to your Export Manager account.",
    );
  }
}

export type GenesysIdentityLink = {
  user_id: string;
  genesys_user_id: string;
  organization_id: string;
  organization_name: string | null;
  genesys_name: string | null;
  genesys_username: string;
  genesys_email: string | null;
  region: string;
  linked_at: string;
  last_verified_at: string | null;
};

export async function getSavedGenesysIdentity(
  userId: string,
): Promise<GenesysIdentityLink | null> {
  if (!userId.trim()) {
    throw new Error("A signed-in user is required.");
  }

  const { data, error } = await supabase
    .from("genesys_identity_links")
    .select(
      [
        "user_id",
        "genesys_user_id",
        "organization_id",
        "organization_name",
        "genesys_name",
        "genesys_username",
        "genesys_email",
        "region",
        "linked_at",
        "last_verified_at",
      ].join(", "),
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load the linked Genesys identity: ${error.message}`,
    );
  }

  return data as GenesysIdentityLink | null;
}