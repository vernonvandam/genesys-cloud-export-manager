import { useCallback, useEffect, useState } from "react";
import { AlertBlock } from "genesys-react-components";

import { useAuth } from "../../auth/useAuth";
import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import { supabase } from "../../lib/supabaseClient";

type Organization = {
  id: string;
  name: string;
  region: string | null;
  local_user_count: number;
  integrated_user_count: number;
  tooling_count: number;
  storage_count: number;
};

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

function isOrganization(value: unknown): value is Organization {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "region" in value &&
    (typeof value.region === "string" || value.region === null) &&
    "local_user_count" in value &&
    typeof value.local_user_count === "number" &&
    "integrated_user_count" in value &&
    typeof value.integrated_user_count === "number" &&
    "tooling_count" in value &&
    typeof value.tooling_count === "number" &&
    "storage_count" in value &&
    typeof value.storage_count === "number"
  );
}

export default function OrganizationAdministrationSection() {
  const { mode } = useAuth();
  const { profile, refreshProfile } = useSupabaseAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [region, setRegion] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase.rpc(
        "list_organizations_admin",
      );
      if (listError) throw listError;
      if (!Array.isArray(data) || !data.every(isOrganization)) {
        throw new Error("Supabase returned invalid organization data.");
      }
      setOrganizations(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load organizations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "standalone" && profile?.role === "global_admin") {
      void loadOrganizations();
    }
  }, [mode, profile?.role, loadOrganizations]);

  if (mode !== "standalone" || profile?.role !== "global_admin") return null;

  function resetForm() {
    setOrganizationId("");
    setOrganizationName("");
    setRegion("");
    setEditingId(null);
  }

  function startEditing(organization: Organization) {
    setOrganizationId(organization.id);
    setOrganizationName(organization.name);
    setRegion(organization.region ?? "");
    setEditingId(organization.id);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase.rpc("save_organization", {
        p_id: editingId ?? organizationId.trim(),
        p_name: organizationName.trim(),
        p_region: region.trim() || null,
      });
      if (saveError) throw saveError;
      resetForm();
      await Promise.all([loadOrganizations(), refreshProfile()]);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the organization."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(organization: Organization) {
    if (
      !window.confirm(
        `Remove "${organization.name}" (${organization.id})? Organizations with users, requests, or configuration data cannot be removed.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.rpc("delete_organization", {
        p_id: organization.id,
      });
      if (deleteError) throw deleteError;
      if (editingId === organization.id) resetForm();
      await Promise.all([loadOrganizations(), refreshProfile()]);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to remove the organization."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel access-admin-panel admin-organization-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Organizations</h2>
          <p className="section-description">
            Add organizations and manage their display name and Genesys Cloud
            region. Organization IDs cannot be changed after creation.
          </p>
        </div>
        <button
          type="button"
          className="tooling-secondary-button"
          onClick={() => void loadOrganizations()}
          disabled={loading || saving}
        >
          Refresh
        </button>
      </div>

      {error && (
        <AlertBlock alertType="critical" title="Organization management">
          {error}
        </AlertBlock>
      )}

      <form
        className="tooling-form admin-organization-form"
        onSubmit={(event) => void handleSave(event)}
      >
        <h3 className="tooling-form-title">
          {editingId ? "Edit organization" : "Add organization"}
        </h3>
        <label className="auth-field">
          <span>Genesys Cloud organization ID</span>
          <input
            className="auth-input"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            disabled={Boolean(editingId)}
            required
          />
        </label>
        <label className="auth-field">
          <span>Organization name</span>
          <input
            className="auth-input"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />
        </label>
        <label className="auth-field">
          <span>Genesys Cloud region</span>
          <input
            className="auth-input"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="e.g. mypurecloud.com.au"
          />
        </label>
        <div className="tooling-form-actions">
          <button
            type="submit"
            className="tooling-primary-button"
            disabled={saving || !organizationId.trim() || !organizationName.trim()}
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add organization"}
          </button>
          {editingId && (
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="access-request-list">
        <h3 className="admin-subsection-title">Organization directory</h3>
        {loading && <p>Loading organizations...</p>}
        {!loading && !error && organizations.length === 0 && (
          <p>No organizations have been added.</p>
        )}
        {organizations.map((organization) => (
          <article className="access-request-item" key={organization.id}>
            <div>
              <strong>{organization.name}</strong>
              <span>ID: {organization.id}</span>
              <span>Region: {organization.region || "Not set"}</span>
              <small>
                {organization.local_user_count} local users ·{" "}
                {organization.integrated_user_count} integrated users ·{" "}
                {organization.tooling_count} tooling configs ·{" "}
                {organization.storage_count} storage accounts
              </small>
            </div>
            <div className="access-request-actions">
              <button
                type="button"
                className="tooling-secondary-button"
                onClick={() => startEditing(organization)}
                disabled={saving}
              >
                Edit
              </button>
              <button
                type="button"
                className="tooling-danger-button"
                onClick={() => void handleDelete(organization)}
                disabled={saving}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
