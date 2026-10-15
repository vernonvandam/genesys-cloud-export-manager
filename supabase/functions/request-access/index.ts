import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET")?.trim() ?? "";

const TURNSTILE_HOSTNAMES = new Set(
  (Deno.env.get("TURNSTILE_HOSTNAMES") ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean),
);

const TURNSTILE_ACTION = "request_access";

async function verifyTurnstileToken(value: unknown): Promise<boolean> {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 2048
  ) {
    return false;
  }

  if (!TURNSTILE_SECRET || TURNSTILE_HOSTNAMES.size === 0) {
    console.error("Turnstile verification is not configured.");
    return false;
  }

  let response: Response;

  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET,
          response: value,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    console.error("Turnstile Siteverify request failed.");
    return false;
  }

  if (!response.ok) {
    console.error(
      "Turnstile Siteverify returned HTTP status:",
      response.status,
    );
    return false;
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    console.error("Turnstile Siteverify returned invalid JSON.");
    return false;
  }

  if (typeof result !== "object" || result === null) {
    return false;
  }

  const verification = result as Record<string, unknown>;

  return (
    verification.success === true &&
    verification.action === TURNSTILE_ACTION &&
    typeof verification.hostname === "string" &&
    TURNSTILE_HOSTNAMES.has(verification.hostname.toLowerCase())
  );
}

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
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const displayName =
      typeof body.display_name === "string"
        ? body.display_name.trim()
        : "";

    const organizationId =
      typeof body.organization_id === "string"
        ? body.organization_id.trim()
        : "";

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320 ||
      displayName.length < 1 ||
      displayName.length > 120 ||
      organizationId.length < 1 ||
      organizationId.length > 128 ||
      message.length > 2000
    ) {
      return jsonResponse(
        {
          error:
            "Enter a valid name, email, and Genesys organization ID.",
        },
        400,
      );
    }

    // Verify the single-use Turnstile token before database access.
    if (!(await verifyTurnstileToken(body.turnstile_token))) {
      return jsonResponse(
        {
          error:
            "Security verification failed. Complete the challenge and try again.",
        },
        403,
      );
    }

    const {
      data: integratedIdentity,
      error: integratedLookupError,
    } = await adminClient
      .from("integrated_users")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (integratedLookupError) throw integratedLookupError;

    if (integratedIdentity) {
      return jsonResponse(
        {
          error:
            "This identity uses Genesys-integrated sign-in and cannot request a standalone account.",
        },
        409,
      );
    }

    const { data: existing, error: lookupError } = await adminClient
      .from("access_requests")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing?.status === "approved") {
      return jsonResponse(
        {
          error:
            "This email already has approved access. Use the email sign-in option.",
        },
        409,
      );
    }

    const { error } = await adminClient
      .from("access_requests")
      .upsert(
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

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit the access request.",
      },
      500,
    );
  }
});