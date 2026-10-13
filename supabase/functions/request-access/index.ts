import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await readJson(request);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim() : "";
    const organizationId =
      typeof body.organization_id === "string" ? body.organization_id.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
      displayName.length < 1 || displayName.length > 120 ||
      organizationId.length < 1 || organizationId.length > 128 ||
      message.length > 2000
    ) {
      return jsonResponse({ error: "Enter a valid name, email, and Genesys organization ID." }, 400);
    }

    const { data: integratedIdentity, error: integratedLookupError } =
      await adminClient
        .from("integrated_users")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
    if (integratedLookupError) throw integratedLookupError;
    if (integratedIdentity) {
      return jsonResponse({
        error: "This identity uses Genesys-integrated sign-in and cannot request a standalone account.",
      }, 409);
    }

    const { data: existing, error: lookupError } = await adminClient
      .from("access_requests")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.status === "approved") {
      return jsonResponse({
        error: "This email already has approved access. Use the email sign-in option.",
      }, 409);
    }

    const { error } = await adminClient.from("access_requests").upsert(
      {
        email,
        display_name: displayName,
        requested_organization_id: organizationId,
        message,
        status: "pending",
        user_id: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) throw error;

    return jsonResponse({ accepted: true });
  } catch (error) {
    console.error("request-access failed", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unable to submit the access request.",
    }, 500);
  }
});
