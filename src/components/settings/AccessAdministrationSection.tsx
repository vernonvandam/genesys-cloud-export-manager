import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertBlock } from "genesys-react-components";

import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import { useAuth } from "../../auth/useAuth";
import { supabase } from "../../lib/supabaseClient";

type AccessRequest = {
  id: string;
  email: string;
  display_name: string;
  requested_organization_id: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user_id: string | null;
};

type LocalUser = {
  id: string;
  email: string;
  display_name: string;
  company_name: string | null;
  role: "member" | "global_admin";
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  organizations: { id: string; name: string }[];
};

type OrganizationOption = { id: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export default function AccessAdministrationSection() {
  const { profile, refreshProfile } = useSupabaseAuth();
  const { mode } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [availableOrganizations, setAvailableOrganizations] = useState<
    OrganizationOption[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");

  const loadAdministrationData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [requestResult, userResult, organizationResult] = await Promise.all([
        supabase.rpc("list_access_requests"),
        supabase.rpc("list_local_users"),
        supabase.rpc("list_organizations_admin"),
      ]);
      if (requestResult.error) throw requestResult.error;
      if (userResult.error) throw userResult.error;
      if (organizationResult.error) throw organizationResult.error;
      if (
        !Array.isArray(requestResult.data) ||
        !Array.isArray(userResult.data) ||
        !Array.isArray(organizationResult.data)
      ) {
        throw new Error("Supabase returned invalid access administration data.");
      }
      if (
        !requestResult.data.every(
          (row) =>
            isRecord(row) &&
            typeof row.id === "string" &&
            typeof row.email === "string" &&
            typeof row.requested_organization_id === "string",
        ) ||
        !userResult.data.every(
          (row) =>
            isRecord(row) &&
            typeof row.id === "string" &&
            typeof row.email === "string" &&
            Array.isArray(row.organizations),
        ) ||
        !organizationResult.data.every(
          (row) =>
            isRecord(row) &&
            typeof row.id === "string" &&
            typeof row.name === "string",
        )
      ) {
        throw new Error("Supabase returned incomplete access administration data.");
      }
      setRequests(requestResult.data as AccessRequest[]);
      setUsers(userResult.data as LocalUser[]);
      setAvailableOrganizations(
        organizationResult.data as OrganizationOption[],
      );
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          "Unable to load access administration data.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "standalone" && profile?.role === "global_admin") {
      void loadAdministrationData();
    }
  }, [mode, profile?.role, loadAdministrationData]);

  if (mode !== "standalone" || profile?.role !== "global_admin") return null;

  async function reviewRequest(request: AccessRequest, approve: boolean) {
    setSaving(true);
    setError("");
    try {
      const { error: reviewError } = await supabase.rpc("review_access_request", {
        p_request_id: request.id,
        p_approve: approve,
        p_organization_name: request.requested_organization_id,
      });
      if (reviewError) throw reviewError;
      if (approve) await refreshProfile();
      await loadAdministrationData();
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, "Unable to update the access request."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: assignError } = await supabase.rpc(
        "assign_user_organization",
        {
          p_user_id: userId,
          p_organization_id: organizationId.trim(),
          p_organization_name:
            availableOrganizations.find((item) => item.id === organizationId)
              ?.name ?? organizationId.trim(),
        },
      );
      if (assignError) throw assignError;
      setOrganizationId("");
      await refreshProfile();
      await loadAdministrationData();
    } catch (assignError) {
      setError(getErrorMessage(assignError, "Unable to assign the organization."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser(
    event: FormEvent<HTMLFormElement>,
    user: LocalUser,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase.rpc("update_local_user", {
        p_user_id: user.id,
        p_display_name: String(form.get("display_name") ?? ""),
        p_company_name: String(form.get("company_name") ?? ""),
        p_approval_status: String(form.get("approval_status") ?? ""),
      });
      if (updateError) throw updateError;
      await loadAdministrationData();
    } catch (updateError) {
      setError(getErrorMessage(updateError, "Unable to update the user."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveUserOrganization(
    user: LocalUser,
    organization: { id: string; name: string },
  ) {
    if (
      !window.confirm(
        `Remove ${user.email}'s access to "${organization.name}"?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: removeError } = await supabase.rpc(
        "remove_user_organization",
        { p_user_id: user.id, p_organization_id: organization.id },
      );
      if (removeError) throw removeError;
      await loadAdministrationData();
    } catch (removeError) {
      setError(
        getErrorMessage(
          removeError,
          "Unable to remove the organization assignment.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(user: LocalUser) {
    if (
      !window.confirm(
        `Permanently delete ${user.email} and their local Export Manager account? This cannot be undone.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-account",
        {
          body: { confirmation: "DELETE", targetUserId: user.id },
        },
      );
      if (deleteError) throw deleteError;
      await loadAdministrationData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete the local user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel access-admin-panel admin-users-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Users</h2>
          <p className="section-description">
            Review access requests, manage local accounts, and maintain their
            organization assignments.
          </p>
        </div>
        <button
          type="button"
          className="tooling-secondary-button"
          onClick={() => void loadAdministrationData()}
          disabled={loading || saving}
        >
          Refresh
        </button>
      </div>

      {error && (
        <AlertBlock alertType="critical" title="User management">
          {error}
        </AlertBlock>
      )}

      <div className="access-request-list">
        <h3 className="admin-subsection-title">Standalone access requests</h3>
        {loading && <p>Loading requests...</p>}
        {!loading && !error && requests.length === 0 && (
          <p>No access requests have been submitted.</p>
        )}
        {requests.map((request) => (
          <article className="access-request-item" key={request.id}>
            <div>
              <strong>{request.display_name}</strong>
              <span>{request.email}</span>
              <span>Genesys organization ID: {request.requested_organization_id}</span>
              {request.message && <p>{request.message}</p>}
              <small>
                {request.status} · {new Date(request.created_at).toLocaleString()}
              </small>
            </div>
            {request.status === "pending" && (
              <div className="access-request-actions">
                <button
                  type="button"
                  className="tooling-primary-button"
                  onClick={() => void reviewRequest(request, true)}
                  disabled={saving}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="tooling-danger-button"
                  onClick={() => void reviewRequest(request, false)}
                  disabled={saving}
                >
                  Reject
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="access-request-list">
        <h3 className="admin-subsection-title">Local users</h3>
        {users.length === 0 && !loading && !error && (
          <p>No local users were found.</p>
        )}
        {users.map((user) => (
          <article className="access-request-item admin-user-item" key={user.id}>
            <div className="admin-user-summary">
              <strong>{user.display_name}</strong>
              <span>{user.email}</span>
              <small>
                {user.approval_status} · Joined{" "}
                {new Date(user.created_at).toLocaleDateString()}
              </small>
              <div className="admin-user-organizations">
                <strong>Organization access</strong>
                {user.organizations.length === 0 && <span>None assigned</span>}
                {user.organizations.map((organization) => (
                  <span key={organization.id}>
                    {organization.name} ({organization.id})
                    <button
                      type="button"
                      className="admin-inline-remove"
                      onClick={() =>
                        void handleRemoveUserOrganization(user, organization)
                      }
                      disabled={saving}
                    >
                      Remove access
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <form
              className="admin-user-edit-form"
              onSubmit={(event) => void handleUpdateUser(event, user)}
            >
              <label className="auth-field">
                <span>Display name</span>
                <input
                  className="auth-input"
                  name="display_name"
                  defaultValue={user.display_name}
                  required
                />
              </label>
              <label className="auth-field">
                <span>Company</span>
                <input
                  className="auth-input"
                  name="company_name"
                  defaultValue={user.company_name ?? ""}
                />
              </label>
              <label className="auth-field">
                <span>Approval status</span>
                <select
                  className="auth-input"
                  name="approval_status"
                  defaultValue={user.approval_status}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <div className="access-request-actions">
                <button
                  type="submit"
                  className="tooling-primary-button"
                  disabled={saving}
                >
                  Save user
                </button>
                <button
                  type="button"
                  className="tooling-danger-button"
                  onClick={() => void handleDeleteUser(user)}
                  disabled={saving}
                >
                  Delete user
                </button>
              </div>
            </form>
          </article>
        ))}
      </div>

      <form
        className="tooling-form admin-assignment-form"
        onSubmit={handleAssignOrganization}
      >
        <h3 className="tooling-form-title">Assign another organization</h3>
        <label className="auth-field">
          <span>Approved local user</span>
          <select
            className="auth-input"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
          >
            <option value="">Select a user</option>
            {users
              .filter((user) => user.approval_status === "approved")
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name} ({user.email})
                </option>
              ))}
          </select>
        </label>
        <label className="auth-field">
          <span>Organization</span>
          <select
            className="auth-input"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            required
          >
            <option value="">Select an organization</option>
            {availableOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} ({organization.id})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="tooling-primary-button"
          disabled={saving || !userId || !organizationId.trim()}
        >
          {saving ? "Saving..." : "Assign organization"}
        </button>
      </form>
    </section>
  );
}
