import { bearerToken, corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { verifyGenesysAccessToken } from "../_shared/genesys.ts";
import { adminClient } from "../_shared/supabase.ts";

const allowedRpcNames = new Set([
  "list_tooling_configurations",
  "save_tooling_configuration",
  "delete_tooling_configuration",
  "list_storage_accounts",
  "save_storage_account",
  "delete_storage_account",
  "list_storage_account_test_logs",
  "get_storage_account_test_log",
]);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await readJson(request);
    const identity = await verifyGenesysAccessToken(
      bearerToken(request),
      body.region,
    );
    const { data: storedIdentity, error: identityError } = await adminClient
      .from("integrated_users")
      .select("id")
      .eq("organization_id", identity.organizationId)
      .eq("genesys_user_id", identity.userId)
      .maybeSingle();
    if (identityError) throw identityError;
    if (!storedIdentity) {
      return jsonResponse({ error: "Complete Genesys sign-in before accessing organization data." }, 403);
    }

    if (typeof body.action !== "string" || !allowedRpcNames.has(body.action)) {
      return jsonResponse({ error: "Unsupported organization data action." }, 400);
    }
    const params =
      typeof body.params === "object" && body.params !== null && !Array.isArray(body.params)
        ? body.params as Record<string, unknown>
        : {};
    const { data, error } = await adminClient.rpc(body.action, {
      ...params,
      p_organization_id: identity.organizationId,
    });
    if (error) throw error;
    return jsonResponse({ data });
  } catch (error) {
    console.error("org-data failed", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unable to access organization data.",
    }, 403);
  }
});
