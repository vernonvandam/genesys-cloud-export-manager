import { bearerToken, corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await readJson(request);
    if (body.confirmation !== "DELETE") {
      return jsonResponse({ error: "Account deletion confirmation is required." }, 400);
    }
    const token = bearerToken(request);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "A valid local user session is required." }, 401);

    if (body.targetUserId !== undefined) {
      if (typeof body.targetUserId !== "string" || !body.targetUserId.trim()) {
        return jsonResponse({ error: "A valid target user ID is required." }, 400);
      }

      const { data: callerProfile, error: callerProfileError } = await adminClient
        .from("profiles")
        .select("role, approval_status")
        .eq("id", user.id)
        .maybeSingle();
      if (callerProfileError) throw callerProfileError;
      if (
        callerProfile?.role !== "global_admin" ||
        callerProfile.approval_status !== "approved"
      ) {
        return jsonResponse({ error: "Approved global administrator access is required." }, 403);
      }
      if (body.targetUserId === user.id) {
        return jsonResponse({ error: "You cannot delete your own administrator account." }, 400);
      }

      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", body.targetUserId)
        .maybeSingle();
      if (targetProfileError) throw targetProfileError;
      if (!targetProfile) {
        return jsonResponse({ error: "Local user not found." }, 404);
      }
      if (targetProfile.role === "global_admin") {
        return jsonResponse({ error: "Global administrator accounts cannot be deleted from the application." }, 403);
      }

      const { error: deleteTargetError } = await adminClient.auth.admin.deleteUser(body.targetUserId);
      if (deleteTargetError) throw deleteTargetError;
      return jsonResponse({ deleted: true });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role === "global_admin") {
      return jsonResponse({ error: "Global administrator accounts cannot be deleted from the application." }, 403);
    }

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unable to delete the account.",
    }, 500);
  }
});
