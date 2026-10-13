import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import { useAuth } from "../../auth/useAuth";
import { callOrgRpc } from "../../lib/orgData";

type ToolingConfiguration = {
  id: string;
  name: string;
  environment: string;
  endpoint: string;
  description: string;
  enabled: boolean;
  grant_type: "client_credentials";
  client_id: string;
  has_secret: boolean;
  created_at: string;
  updated_at: string;
};

type ToolingFormData = {
  name: string;
  environment: string;
  endpoint: string;
  description: string;
  enabled: boolean;
  grantType: "client_credentials";
  clientId: string;
  clientSecret: string;
};

const EMPTY_TOOLING_FORM: ToolingFormData = {
  name: "",
  environment: "Production",
  endpoint: "",
  description: "",
  enabled: true,
  grantType: "client_credentials",
  clientId: "",
  clientSecret: "",
};

function redactClientId(clientId: string | null | undefined): string {
  const value = clientId?.trim();
  if (!value) return "Not configured";
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 4)}[REDACTED]${value.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolingConfiguration(value: unknown): value is ToolingConfiguration {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.environment === "string" &&
    typeof value.endpoint === "string" &&
    typeof value.description === "string" &&
    typeof value.enabled === "boolean" &&
    value.grant_type === "client_credentials" &&
    typeof value.client_id === "string" &&
    typeof value.has_secret === "boolean" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function parseToolingConfiguration(value: unknown): ToolingConfiguration {
  if (!isToolingConfiguration(value)) {
    throw new Error("Supabase returned an invalid tooling configuration.");
  }
  return value;
}

export default function ToolingConfigurationsSection() {
  const { user: standaloneUser, activeOrganizationId } = useSupabaseAuth();
  const { mode, user: genesysUser, organization, accessToken, config } = useAuth();
  const organizationId =
    mode === "integrated" ? organization?.id ?? null : activeOrganizationId;
  const integrated = useMemo(
    () =>
      mode === "integrated" && accessToken
        ? { accessToken, region: config.region }
        : undefined,
    [mode, accessToken, config.region],
  );
  const hasSession = mode === "integrated" ? Boolean(genesysUser) : Boolean(standaloneUser);
  const [toolingConfigurations, setToolingConfigurations] = useState<ToolingConfiguration[]>([]);
  const [toolingLoading, setToolingLoading] = useState(true);
  const [toolingSaving, setToolingSaving] = useState(false);
  const [toolingError, setToolingError] = useState("");
  const [toolingFormOpen, setToolingFormOpen] = useState(false);
  const [editingToolingId, setEditingToolingId] = useState<string | null>(null);
  const [toolingFormData, setToolingFormData] = useState<ToolingFormData>({ ...EMPTY_TOOLING_FORM });
  const [toolingFormError, setToolingFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadToolingConfigurations() {
      setToolingConfigurations([]);
      setToolingError("");

      if (!hasSession || !organizationId) {
        setToolingLoading(false);
        return;
      }

      setToolingLoading(true);
      try {
        const { data, error } = await callOrgRpc<unknown[]>(
          "list_tooling_configurations",
          { p_organization_id: organizationId },
          integrated,
        );
        if (error) throw new Error(error.message);
        if (!Array.isArray(data)) {
          throw new Error("Supabase returned an unexpected tooling configuration list.");
        }

        const configurations = data.map(parseToolingConfiguration);
        if (active) setToolingConfigurations(configurations);
      } catch (error) {
        if (active) {
          setToolingError(
            error instanceof Error ? error.message : "Unable to load tooling configurations.",
          );
        }
      } finally {
        if (active) setToolingLoading(false);
      }
    }

    void loadToolingConfigurations();
    return () => {
      active = false;
    };
  }, [hasSession, organizationId, integrated]);

  function openNewToolingForm() {
    setEditingToolingId(null);
    setToolingFormData({ ...EMPTY_TOOLING_FORM });
    setToolingFormError("");
    setToolingError("");
    setToolingFormOpen(true);
  }

  function openEditToolingForm(item: ToolingConfiguration) {
    setEditingToolingId(item.id);
    setToolingFormData({
      name: item.name,
      environment: item.environment,
      endpoint: item.endpoint,
      description: item.description,
      enabled: item.enabled,
      grantType: item.grant_type,
      clientId: item.client_id,
      // Saved secrets are never retrieved or prefilled. Blank retains the existing secret.
      clientSecret: "",
    });
    setToolingFormError("");
    setToolingError("");
    setToolingFormOpen(true);
  }

  function closeToolingForm() {
    setToolingFormOpen(false);
    setEditingToolingId(null);
    setToolingFormData({ ...EMPTY_TOOLING_FORM });
    setToolingFormError("");
  }

  async function handleSaveTooling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToolingFormError("");
    setToolingError("");

    if (!hasSession || !organizationId) {
      setToolingFormError("You must be signed in to save a tooling configuration.");
      return;
    }

    const name = toolingFormData.name.trim();
    const clientId = toolingFormData.clientId.trim();
    const clientSecret = toolingFormData.clientSecret.trim();
    const endpoint = toolingFormData.endpoint.trim();

    if (!name) {
      setToolingFormError("Enter a name for this tooling configuration.");
      return;
    }
    if (!clientId) {
      setToolingFormError("Enter the OAuth Client ID.");
      return;
    }

    const editingConfiguration = toolingConfigurations.find((item) => item.id === editingToolingId);
    if (!editingToolingId && !clientSecret) {
      setToolingFormError("Enter the OAuth Client Secret for this new configuration.");
      return;
    }
    if (editingToolingId && !editingConfiguration?.has_secret && !clientSecret) {
      setToolingFormError("Enter a Client Secret for this configuration.");
      return;
    }

    if (endpoint) {
      try {
        const parsed = new URL(endpoint);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("Unsupported URL protocol");
        }
      } catch {
        setToolingFormError("Enter a valid HTTP or HTTPS URL, or leave the endpoint blank.");
        return;
      }
    }

    setToolingSaving(true);
    try {
      const { data, error } = await callOrgRpc<unknown>("save_tooling_configuration", {
        p_id: editingToolingId,
        p_organization_id: organizationId,
        p_name: name,
        p_environment: toolingFormData.environment,
        p_endpoint: endpoint,
        p_description: toolingFormData.description.trim(),
        p_enabled: toolingFormData.enabled,
        p_grant_type: toolingFormData.grantType,
        p_client_id: clientId,
        // Supabase stores this server-side in Vault.
        p_client_secret: clientSecret,
      }, integrated);
      if (error) throw new Error(error.message);

      const saved = parseToolingConfiguration(data);
      setToolingConfigurations((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
      });
      closeToolingForm();
    } catch (error) {
      setToolingFormError(
        error instanceof Error ? error.message : "Unable to save tooling configuration.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  async function handleToggleTooling(item: ToolingConfiguration) {
    if (toolingSaving) return;
    setToolingError("");
    setToolingSaving(true);
    try {
      const { data, error } = await callOrgRpc<unknown>("save_tooling_configuration", {
        p_id: item.id,
        p_organization_id: organizationId,
        p_name: item.name,
        p_environment: item.environment,
        p_endpoint: item.endpoint,
        p_description: item.description,
        p_enabled: !item.enabled,
        p_grant_type: item.grant_type,
        p_client_id: item.client_id,
        // An empty secret means retain the saved Vault secret.
        p_client_secret: "",
      }, integrated);
      if (error) throw new Error(error.message);
      const updated = parseToolingConfiguration(data);
      setToolingConfigurations((current) =>
        current.map((configuration) => (configuration.id === updated.id ? updated : configuration)),
      );
    } catch (error) {
      setToolingError(
        error instanceof Error ? error.message : "Unable to change the configuration state.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  async function handleRemoveTooling(item: ToolingConfiguration) {
    const confirmed = window.confirm(
      `Remove the tooling configuration "${item.name}" and its saved Client Secret?`,
    );
    if (!confirmed) return;

    setToolingError("");
    setToolingSaving(true);
    try {
      const { data, error } = await callOrgRpc<boolean>(
        "delete_tooling_configuration",
        { p_id: item.id, p_organization_id: organizationId },
        integrated,
      );
      if (error) throw new Error(error.message);
      if (data !== true) {
        throw new Error("The configuration was not found or was already removed.");
      }
      setToolingConfigurations((current) => current.filter((configuration) => configuration.id !== item.id));
      if (editingToolingId === item.id) closeToolingForm();
    } catch (error) {
      setToolingError(
        error instanceof Error ? error.message : "Unable to remove tooling configuration.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  return (
    <section className="panel tooling-panel">
      <div className="tooling-section-heading">
        <div>
          <h2 className="section-title">Tooling configurations</h2>
          <p className="section-description">
            Manage configuration profiles shared with users assigned to the
            selected Genesys Cloud organization.
          </p>
        </div>
        <button
          type="button"
          className="tooling-primary-button"
          onClick={() => (toolingFormOpen ? closeToolingForm() : openNewToolingForm())}
          disabled={toolingSaving || toolingLoading}
        >
          {toolingFormOpen ? "Close form" : "+ Add configuration"}
        </button>
      </div>

      <div className="tooling-notice">
        Tooling configurations and Client Secrets are managed through Supabase. Secrets are stored in Supabase Vault and are not returned to the browser after saving.
      </div>

      {toolingError && <AlertBlock alertType="critical" title="Tooling configurations">{toolingError}</AlertBlock>}
      {toolingFormError && <AlertBlock alertType="critical" title="Check the tooling form">{toolingFormError}</AlertBlock>}

      {toolingLoading ? (
        <p className="auth-description">Loading tooling configurations...</p>
      ) : !hasSession ? (
        <AlertBlock alertType="info" title="Export Manager account required">
          Sign in to manage your tooling configurations.
        </AlertBlock>
      ) : (
        <>
          {toolingFormOpen && (
            <form className="tooling-form" onSubmit={handleSaveTooling}>
              <h3 className="tooling-form-title">
                {editingToolingId ? "Edit tooling configuration" : "Add tooling configuration"}
              </h3>
              <div className="tooling-form-grid">
                <label className="tooling-field">
                  <span>Configuration name</span>
                  <input className="auth-input" type="text" value={toolingFormData.name}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Production export" maxLength={100} required />
                </label>
                <label className="tooling-field">
                  <span>Environment</span>
                  <select className="auth-input" value={toolingFormData.environment}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, environment: event.target.value }))}>
                    <option value="Production">Production</option><option value="Test">Test</option><option value="Development">Development</option>
                  </select>
                </label>
                <label className="tooling-field">
                  <span>Grant Type</span><input className="auth-input" type="text" value="Client Credentials" readOnly />
                </label>
                <label className="tooling-field">
                  <span>Client ID</span>
                  <input className="auth-input" type="text" autoComplete="off" value={toolingFormData.clientId}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, clientId: event.target.value }))}
                    placeholder="Enter OAuth Client ID" maxLength={255} required />
                </label>
                <label className="tooling-field tooling-field-full">
                  <span>Client Secret</span>
                  <input className="auth-input" type="password" autoComplete="new-password" value={toolingFormData.clientSecret}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, clientSecret: event.target.value }))}
                    placeholder={editingToolingId && toolingConfigurations.find((item) => item.id === editingToolingId)?.has_secret
                      ? "Saved secret exists — enter a new one to replace it" : "Enter OAuth Client Secret"}
                    required={!editingToolingId || !toolingConfigurations.some((item) => item.id === editingToolingId && item.has_secret)} />
                  <span className="auth-field-help">
                    {editingToolingId && toolingConfigurations.some((item) => item.id === editingToolingId && item.has_secret)
                      ? "Leave blank to keep the existing Vault secret. Enter a value only when replacing it."
                      : "The secret is required for a new configuration and will be sent to Supabase Vault."}
                  </span>
                </label>
                <label className="tooling-field tooling-field-full">
                  <span>Connection endpoint (optional)</span>
                  <input className="auth-input" type="url" value={toolingFormData.endpoint}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, endpoint: event.target.value }))}
                    placeholder="https://service.example.com" />
                </label>
                <label className="tooling-field tooling-field-full">
                  <span>Description / notes</span>
                  <textarea className="tooling-textarea" value={toolingFormData.description}
                    onChange={(event) => setToolingFormData((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Describe when this configuration is used." rows={3} maxLength={1000} />
                </label>
              </div>
              <label className="tooling-enabled-field">
                <input type="checkbox" checked={toolingFormData.enabled}
                  onChange={(event) => setToolingFormData((current) => ({ ...current, enabled: event.target.checked }))} />
                <span>Configuration enabled</span>
              </label>
              <div className="tooling-form-actions">
                <button type="button" className="tooling-secondary-button" onClick={closeToolingForm} disabled={toolingSaving}>Cancel</button>
                <button type="submit" className="tooling-primary-button" disabled={toolingSaving}>
                  {toolingSaving ? "Saving..." : editingToolingId ? "Save changes" : "Add configuration"}
                </button>
              </div>
            </form>
          )}

          {toolingConfigurations.length === 0 ? (
            <div className="tooling-empty-state">
              <div className="tooling-empty-icon"><GenesysDevIcon icon={GenesysDevIcons.AppDataSource} /></div>
              <h3>No tooling configurations yet</h3>
              <p>Add a profile to organise the connections used by export services.</p>
              {!toolingFormOpen && <button type="button" className="tooling-secondary-button" onClick={openNewToolingForm}>Add your first configuration</button>}
            </div>
          ) : (
            <div className="tooling-config-list">
              {toolingConfigurations.map((item) => (
                <article className="tooling-config-card" key={item.id}>
                  <div className="tooling-config-main">
                    <div className="tooling-config-icon"><GenesysDevIcon icon={GenesysDevIcons.AppDataSource} /></div>
                    <div className="tooling-config-copy">
                      <div className="tooling-config-title-row">
                        <h3>{item.name}</h3>
                        <span className={`status-pill ${item.enabled ? "status-completed" : "status-planned"}`}>{item.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <span className="tooling-config-environment">{item.environment}</span>
                      <p>Grant Type: Client Credentials</p>
                      <p>Client ID: {redactClientId(item.client_id)}</p>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </div>
                  <div className="tooling-card-actions">
                    <label className="settings-switch">
                      <input type="checkbox" checked={item.enabled} disabled={toolingSaving} onChange={() => void handleToggleTooling(item)} aria-label={`Enable ${item.name}`} />
                      <span className="settings-switch-track" aria-hidden="true" />
                      <span className="settings-switch-label">{item.enabled ? "Enabled" : "Disabled"}</span>
                    </label>
                    <button type="button" className="tooling-secondary-button" onClick={() => openEditToolingForm(item)} disabled={toolingSaving}>Edit</button>
                    <button type="button" className="tooling-danger-button" onClick={() => void handleRemoveTooling(item)} disabled={toolingSaving}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
