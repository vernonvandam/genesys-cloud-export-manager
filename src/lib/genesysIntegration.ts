import { supabase } from "./supabaseClient";

import type {
  GenesysIntegration,
  GenesysIntegrationInput,
} from "../types/genesysIntegration";

const INTEGRATION_FIELDS =
  "user_id, client_id, region, redirect_uri, enabled, created_at, updated_at";

function validateUserId(userId: string) {
  if (!userId.trim()) {
    throw new Error("A signed-in user is required.");
  }
}

export async function getGenesysIntegration(
  userId: string,
): Promise<GenesysIntegration | null> {
  validateUserId(userId);

  const { data, error } = await supabase
    .from("genesys_integrations")
    .select(INTEGRATION_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Genesys configuration: ${error.message}`,
    );
  }

  return data as GenesysIntegration | null;
}

export async function saveGenesysIntegration(
  userId: string,
  input: GenesysIntegrationInput,
): Promise<GenesysIntegration> {
  validateUserId(userId);

  const clientId = input.client_id.trim();
  const region = input.region.trim();
  const redirectUri = input.redirect_uri.trim();

  if (!clientId || !region || !redirectUri) {
    throw new Error(
      "Client ID, region and redirect URI are required.",
    );
  }

  const { data, error } = await supabase
    .from("genesys_integrations")
    .upsert(
      {
        user_id: userId,
        client_id: clientId,
        region,
        redirect_uri: redirectUri,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(INTEGRATION_FIELDS)
    .single();

  if (error) {
    throw new Error(
      `Unable to save Genesys configuration: ${error.message}`,
    );
  }

  return data as GenesysIntegration;
}

export async function setGenesysIntegrationEnabled(
  userId: string,
  enabled: boolean,
): Promise<GenesysIntegration> {
  validateUserId(userId);

  const { data, error } = await supabase
    .from("genesys_integrations")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select(INTEGRATION_FIELDS)
    .single();

  if (error) {
    throw new Error(
      `Unable to update Genesys configuration: ${error.message}`,
    );
  }

  return data as GenesysIntegration;
}

export async function deleteGenesysIntegration(
  userId: string,
): Promise<void> {
  validateUserId(userId);

  const { error } = await supabase
    .from("genesys_integrations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Unable to remove Genesys configuration: ${error.message}`,
    );
  }
}