import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bearerToken,
  corsHeaders,
  jsonResponse,
  readJson,
} from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Required Supabase Edge Function environment variables are missing.",
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

    if (body.confirmation !== "DELETE") {
      return jsonResponse(
        { error: "Account deletion confirmation is required." },
        400,
      );
    }

    const token = bearerToken(request);

    // Validate the caller's Supabase session.
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        { error: "A valid local user session is required." },
        401,
      );
    }

    // Administrator-only deletion of another local user's account.
    if (body.targetUserId !== undefined) {
      if (
        typeof body.targetUserId !== "string" ||
        !body.targetUserId.trim()
      ) {
        return jsonResponse(
          { error: "A valid target user ID is required." },
          400,
        );
      }

      // Evaluate administrator authorization using the caller's JWT.
      // The database function checks role, approval status and the
      // exclusion for identities registered for Genesys-integrated sign-in.
      const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const {
        data: callerIsGlobalAdmin,
        error: callerAdminError,
      } = await callerClient.rpc("is_global_admin");

      if (callerAdminError) {
        throw callerAdminError;
      }

      if (callerIsGlobalAdmin !== true) {
        return jsonResponse(
          {
            error:
              "Approved global administrator access is required.",
          },
          403,
        );
      }

      if (body.targetUserId === user.id) {
        return jsonResponse(
          {
            error:
              "You cannot delete your own administrator account.",
          },
          400,
        );
      }

      // Never allow deletion of another global administrator.
      const {
        data: targetProfile,
        error: targetProfileError,
      } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", body.targetUserId)
        .maybeSingle();

      if (targetProfileError) {
        throw targetProfileError;
      }

      if (!targetProfile) {
        return jsonResponse(
          { error: "Local user not found." },
          404,
        );
      }

      if (targetProfile.role === "global_admin") {
        return jsonResponse(
          {
            error:
              "Global administrator accounts cannot be deleted from the application.",
          },
          403,
        );
      }

      const { error: deleteTargetError } =
        await adminClient.auth.admin.deleteUser(body.targetUserId);

      if (deleteTargetError) {
        throw deleteTargetError;
      }

      return jsonResponse({ deleted: true });
    }

    // Allow a local user to delete their own account, except global
    // administrator accounts, which must be protected from deletion.
    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (profile?.role === "global_admin") {
      return jsonResponse(
        {
          error:
            "Global administrator accounts cannot be deleted from the application.",
        },
        403,
      );
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw deleteError;
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("delete-account failed", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete the account.",
      },
      500,
    );
  }
});