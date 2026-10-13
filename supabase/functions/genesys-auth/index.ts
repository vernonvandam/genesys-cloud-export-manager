import { bearerToken, corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { verifyGenesysAccessToken } from "../_shared/genesys.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await readJson(request);
    const identity = await verifyGenesysAccessToken(
      bearerToken(request),
      body.region,
    );
    const now = new Date().toISOString();
    const { error: organizationError } = await adminClient
      .from("organizations")
      .upsert(
        { id: identity.organizationId, name: identity.organizationName, region: identity.region, updated_at: now },
        { onConflict: "id" },
      );
    if (organizationError) throw organizationError;

    const { data: storedIdentity, error: identityError } = await adminClient
      .from("integrated_users")
      .upsert(
        {
          organization_id: identity.organizationId,
          genesys_user_id: identity.userId,
          name: identity.name,
          username: identity.username,
          email: identity.email,
          region: identity.region,
          last_login_at: now,
          updated_at: now,
        },
        { onConflict: "organization_id,genesys_user_id" },
      )
      .select("id")
      .single();
    if (identityError) throw identityError;

    return jsonResponse({
      user: {
        id: identity.userId,
        name: identity.name,
        username: identity.username,
        email: identity.email,
      },
      organization: {
        id: identity.organizationId,
        name: identity.organizationName,
        region: identity.region,
      },
      integrated_user_id: storedIdentity.id,
    });
  } catch (error) {
    console.error("genesys-auth failed", error);
    const message = error instanceof Error ? error.message : "Unable to verify Genesys Cloud identity.";
    return jsonResponse({ error: message }, 401);
  }
});
