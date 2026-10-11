import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from "genesys-dev-icons";

import ConfigRow from "../components/common/ConfigRow";
import { useSupabaseAuth } from "../auth/useSupabaseAuth";
import { supabase } from "../lib/supabaseClient";

import {
  deleteGenesysIntegration,
  getGenesysIntegration,
  saveGenesysIntegration,
  setGenesysIntegrationEnabled,
} from "../lib/genesysIntegration";

import type { GenesysIntegration } from "../types/genesysIntegration";

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

type GenesysIntegrationFormData = {
  clientId: string;
  region: string;
  redirectUri: string;
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

function createDefaultGenesysForm(): GenesysIntegrationFormData {
  return {
    clientId: "",
    region: "mypurecloud.com.au",
    redirectUri: `${window.location.origin}/auth/genesys/callback`,
  };
}

/**
 * Redacts a Client ID for display in configuration summaries.
 *
 * Keeps the first and last four characters visible.
 * The original Client ID is not modified or overwritten.
 */
function redactClientId(
  clientId: string | null | undefined,
): string {
  const value = clientId?.trim();

  if (!value) {
    return "Not configured";
  }

  if (value.length <= 8) {
    return " [REDACTED] ";
  }

  return `${value.slice(0, 4)} [REDACTED] ${value.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isToolingConfiguration(
  value: unknown,
): value is ToolingConfiguration {
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

function parseToolingConfiguration(
  value: unknown,
): ToolingConfiguration {
  if (!isToolingConfiguration(value)) {
    throw new Error(
      "Supabase returned an invalid tooling configuration.",
    );
  }

  return value;
}

export default function SettingsPage() {
  const {
    user: standaloneUser,
    profile: standaloneProfile,
    signOut,
  } = useSupabaseAuth();

  // ---------------------------------------------------------
  // Local account state
  // ---------------------------------------------------------

  const [signOutError, setSignOutError] = useState("");
  const [accountDeleteError, setAccountDeleteError] =
    useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ---------------------------------------------------------
  // Tooling configuration state
  // Configurations load exclusively from Supabase.
  // No tooling data or secrets are stored in browser storage.
  // ---------------------------------------------------------

  const [toolingConfigurations, setToolingConfigurations] =
    useState<ToolingConfiguration[]>([]);

  const [toolingLoading, setToolingLoading] = useState(true);
  const [toolingSaving, setToolingSaving] = useState(false);
  const [toolingError, setToolingError] = useState("");

  const [toolingFormOpen, setToolingFormOpen] = useState(false);
  const [editingToolingId, setEditingToolingId] =
    useState<string | null>(null);

  const [toolingFormData, setToolingFormData] =
    useState<ToolingFormData>({ ...EMPTY_TOOLING_FORM });

  const [toolingFormError, setToolingFormError] = useState("");

  // ---------------------------------------------------------
  // Genesys Cloud authentication state
  // ---------------------------------------------------------

  const [integration, setIntegration] =
    useState<GenesysIntegration | null>(null);

  const [integrationForm, setIntegrationForm] =
    useState<GenesysIntegrationFormData>(
      createDefaultGenesysForm,
    );

  const [integrationFormOpen, setIntegrationFormOpen] =
    useState(false);

  const [integrationLoading, setIntegrationLoading] =
    useState(true);

  const [integrationSaving, setIntegrationSaving] =
    useState(false);

  const [integrationError, setIntegrationError] = useState("");

  // ---------------------------------------------------------
  // Load Tooling configurations from Supabase
  // ---------------------------------------------------------

  useEffect(() => {
    let active = true;

    async function loadToolingConfigurations() {
      setToolingConfigurations([]);
      setToolingError("");

      if (!standaloneUser?.id) {
        setToolingLoading(false);
        return;
      }

      setToolingLoading(true);

      try {
        const { data, error } = await supabase.rpc(
          "list_tooling_configurations",
        );

        if (error) {
          throw new Error(error.message);
        }

        const rows = data as unknown;

        if (!Array.isArray(rows)) {
          throw new Error(
            "Supabase returned an unexpected tooling configuration list.",
          );
        }

        const configurations = rows.map(
          parseToolingConfiguration,
        );

        if (active) {
          setToolingConfigurations(configurations);
        }
      } catch (error) {
        if (active) {
          setToolingError(
            error instanceof Error
              ? error.message
              : "Unable to load tooling configurations.",
          );
        }
      } finally {
        if (active) {
          setToolingLoading(false);
        }
      }
    }

    void loadToolingConfigurations();

    return () => {
      active = false;
    };
  }, [standaloneUser?.id]);

  // ---------------------------------------------------------
  // Load the current user's Genesys configuration
  // ---------------------------------------------------------

  useEffect(() => {
    let active = true;

    async function loadIntegration() {
      setIntegration(null);

      if (!standaloneUser?.id) {
        setIntegrationForm(createDefaultGenesysForm());
        setIntegrationError("");
        setIntegrationLoading(false);
        return;
      }

      setIntegrationLoading(true);
      setIntegrationError("");

      try {
        const saved = await getGenesysIntegration(
          standaloneUser.id,
        );

        if (!active) return;

        setIntegration(saved);

        setIntegrationForm(
          saved
            ? {
                clientId: saved.client_id,
                region: saved.region,
                redirectUri: saved.redirect_uri,
              }
            : createDefaultGenesysForm(),
        );
      } catch (error) {
        if (!active) return;

        setIntegrationError(
          error instanceof Error
            ? error.message
            : "Unable to load Genesys authentication settings.",
        );
      } finally {
        if (active) {
          setIntegrationLoading(false);
        }
      }
    }

    void loadIntegration();

    return () => {
      active = false;
    };
  }, [standaloneUser?.id]);

  // ---------------------------------------------------------
  // Tooling form handlers
  // ---------------------------------------------------------

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

      // Never retrieve or prefill a saved Client Secret.
      // An empty value during edit means keep the existing secret.
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

  async function handleSaveTooling(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setToolingFormError("");
    setToolingError("");

    if (!standaloneUser?.id) {
      setToolingFormError(
        "You must be signed in to save a tooling configuration.",
      );
      return;
    }

    const name = toolingFormData.name.trim();
    const clientId = toolingFormData.clientId.trim();
    const clientSecret = toolingFormData.clientSecret.trim();
    const endpoint = toolingFormData.endpoint.trim();

    if (!name) {
      setToolingFormError(
        "Enter a name for this tooling configuration.",
      );
      return;
    }

    if (!clientId) {
      setToolingFormError("Enter the OAuth Client ID.");
      return;
    }

    if (!editingToolingId && !clientSecret) {
      setToolingFormError(
        "Enter the OAuth Client Secret for this new configuration.",
      );
      return;
    }

    if (endpoint) {
      try {
        const parsed = new URL(endpoint);

        if (
          parsed.protocol !== "https:" &&
          parsed.protocol !== "http:"
        ) {
          throw new Error("Unsupported URL protocol");
        }
      } catch {
        setToolingFormError(
          "Enter a valid HTTP or HTTPS URL, or leave the endpoint blank.",
        );
        return;
      }
    }

    setToolingSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "save_tooling_configuration",
        {
          p_id: editingToolingId,
          p_name: name,
          p_environment: toolingFormData.environment,
          p_endpoint: endpoint,
          p_description: toolingFormData.description.trim(),
          p_enabled: toolingFormData.enabled,
          p_grant_type: toolingFormData.grantType,
          p_client_id: clientId,

          // On edit, an empty secret retains the saved Vault secret.
          // A supplied secret replaces it. On create, it is required.
          p_client_secret: clientSecret,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const saved = parseToolingConfiguration(data);

      setToolingConfigurations((current) => {
        const exists = current.some(
          (item) => item.id === saved.id,
        );

        return exists
          ? current.map((item) =>
              item.id === saved.id ? saved : item,
            )
          : [saved, ...current];
      });

      // Clear the form so the secret is no longer held in component state.
      closeToolingForm();
    } catch (error) {
      setToolingFormError(
        error instanceof Error
          ? error.message
          : "Unable to save tooling configuration.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  async function handleToggleTooling(
    item: ToolingConfiguration,
  ) {
    if (toolingSaving) return;

    setToolingError("");
    setToolingSaving(true);

    try {
      // Reuse the server-side save function. An empty secret on
      // update retains the existing Vault secret.
      const { data, error } = await supabase.rpc(
        "save_tooling_configuration",
        {
          p_id: item.id,
          p_name: item.name,
          p_environment: item.environment,
          p_endpoint: item.endpoint,
          p_description: item.description,
          p_enabled: !item.enabled,
          p_grant_type: item.grant_type,
          p_client_id: item.client_id,
          p_client_secret: "",
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const updated = parseToolingConfiguration(data);

      setToolingConfigurations((current) =>
        current.map((configuration) =>
          configuration.id === updated.id
            ? updated
            : configuration,
        ),
      );
    } catch (error) {
      setToolingError(
        error instanceof Error
          ? error.message
          : "Unable to change the configuration state.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  async function handleRemoveTooling(
    item: ToolingConfiguration,
  ) {
    const confirmed = window.confirm(
      `Remove the tooling configuration "${item.name}" and its saved Client Secret?`,
    );

    if (!confirmed) return;

    setToolingError("");
    setToolingSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "delete_tooling_configuration",
        {
          p_id: item.id,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data !== true) {
        throw new Error(
          "The configuration was not found or was already removed.",
        );
      }

      setToolingConfigurations((current) =>
        current.filter(
          (configuration) => configuration.id !== item.id,
        ),
      );

      if (editingToolingId === item.id) {
        closeToolingForm();
      }
    } catch (error) {
      setToolingError(
        error instanceof Error
          ? error.message
          : "Unable to remove tooling configuration.",
      );
    } finally {
      setToolingSaving(false);
    }
  }

  // ---------------------------------------------------------
  // Genesys configuration handlers
  // ---------------------------------------------------------

  function openNewIntegrationForm() {
    setIntegrationForm(createDefaultGenesysForm());
    setIntegrationError("");
    setIntegrationFormOpen(true);
  }

  function openEditIntegrationForm() {
    if (!integration) return;

    setIntegrationForm({
      clientId: integration.client_id,
      region: integration.region,
      redirectUri: integration.redirect_uri,
    });

    setIntegrationError("");
    setIntegrationFormOpen(true);
  }

  function closeIntegrationForm() {
    setIntegrationFormOpen(false);
    setIntegrationError("");
  }

  async function handleSaveIntegration(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIntegrationError("");

    if (!standaloneUser?.id) {
      setIntegrationError(
        "Sign in to your Export Manager account before saving this configuration.",
      );
      return;
    }

    const clientId = integrationForm.clientId.trim();
    const region = integrationForm.region.trim();
    const redirectUri = integrationForm.redirectUri.trim();

    if (!clientId || !region || !redirectUri) {
      setIntegrationError(
        "Client ID, region and redirect URI are required.",
      );
      return;
    }

    try {
      const parsedRedirectUri = new URL(redirectUri);

      if (
        parsedRedirectUri.protocol !== "https:" &&
        parsedRedirectUri.protocol !== "http:"
      ) {
        throw new Error("Unsupported URI protocol.");
      }
    } catch {
      setIntegrationError(
        "Enter a valid HTTP or HTTPS redirect URI.",
      );
      return;
    }

    setIntegrationSaving(true);

    try {
      const saved = await saveGenesysIntegration(
        standaloneUser.id,
        {
          client_id: clientId,
          region,
          redirect_uri: redirectUri,
          enabled: integration?.enabled ?? false,
        },
      );

      setIntegration(saved);
      setIntegrationForm({
        clientId: saved.client_id,
        region: saved.region,
        redirectUri: saved.redirect_uri,
      });

      setIntegrationFormOpen(false);
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message
          : "Unable to save Genesys authentication settings.",
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleToggleIntegration(enabled: boolean) {
    if (!standaloneUser?.id || !integration) return;

    setIntegrationError("");
    setIntegrationSaving(true);

    try {
      const updated = await setGenesysIntegrationEnabled(
        standaloneUser.id,
        enabled,
      );

      setIntegration(updated);
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message
          : "Unable to update Genesys authentication settings.",
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleRemoveIntegration() {
    if (!standaloneUser?.id || !integration) return;

    const confirmed = window.confirm(
      "Remove the saved Genesys Cloud authentication configuration? Your Export Manager account will not be affected.",
    );

    if (!confirmed) return;

    setIntegrationError("");
    setIntegrationSaving(true);

    try {
      await deleteGenesysIntegration(standaloneUser.id);

      setIntegration(null);
      setIntegrationForm(createDefaultGenesysForm());
      setIntegrationFormOpen(false);
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message
          : "Unable to remove Genesys authentication settings.",
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  // ---------------------------------------------------------
  // Local account handlers
  // ---------------------------------------------------------

  async function handleSignOut() {
    setSignOutError("");

    try {
      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "Unable to sign out.",
      );
    }
  }

  async function handleDeleteAccount() {
    if (!standaloneUser?.id) return;

    const confirmation = window.prompt(
      "This permanently deletes your Export Manager account and associated database records. This action cannot be undone.\n\nType DELETE to confirm.",
    );

    if (confirmation === null) return;

    if (confirmation.trim() !== "DELETE") {
      setAccountDeleteError(
        "Account deletion cancelled because the confirmation text did not match.",
      );
      return;
    }

    setAccountDeleteError("");
    setDeletingAccount(true);

    try {
      const { error } = await supabase.functions.invoke(
        "delete-account",
        {
          body: { confirmation: "DELETE" },
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      // No tooling configuration or secret is kept in browser storage.
      await supabase.auth.signOut({ scope: "local" });

      window.location.replace("/");
    } catch (error) {
      setAccountDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete the account. Please try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  // ---------------------------------------------------------
  // Render Settings page
  // ---------------------------------------------------------

  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-description">
            Manage tooling configurations, Genesys authentication
            and your Export Manager account.
          </p>
        </div>
      </div>

      {/* =====================================================
          1. TOOLING CONFIGURATIONS
         ===================================================== */}
      <section className="panel tooling-panel">
        <div className="tooling-section-heading">
          <div>
            <h2 className="section-title">
              Tooling configurations
            </h2>
            <p className="section-description">
              Manage named configuration profiles for export
              services and automation connections.
            </p>
          </div>

          <button
            type="button"
            className="tooling-primary-button"
            onClick={() =>
              toolingFormOpen
                ? closeToolingForm()
                : openNewToolingForm()
            }
            disabled={toolingSaving || toolingLoading}
          >
            {toolingFormOpen ? "Close form" : "+ Add configuration"}
          </button>
        </div>

        <div className="tooling-notice">
          Tooling configurations and Client Secrets are managed
          through Supabase. Secrets are stored in Supabase Vault
          and are not returned to the browser after saving.
        </div>

        {toolingError && (
          <AlertBlock
            alertType="critical"
            title="Tooling configurations"
          >
            {toolingError}
          </AlertBlock>
        )}

        {toolingFormError && (
          <AlertBlock
            alertType="critical"
            title="Check the tooling form"
          >
            {toolingFormError}
          </AlertBlock>
        )}

        {toolingLoading ? (
          <p className="auth-description">
            Loading tooling configurations...
          </p>
        ) : !standaloneUser ? (
          <AlertBlock
            alertType="info"
            title="Export Manager account required"
          >
            Sign in to manage your tooling configurations.
          </AlertBlock>
        ) : (
          <>
            {toolingFormOpen && (
              <form
                className="tooling-form"
                onSubmit={handleSaveTooling}
              >
                <h3 className="tooling-form-title">
                  {editingToolingId
                    ? "Edit tooling configuration"
                    : "Add tooling configuration"}
                </h3>

                <div className="tooling-form-grid">
                  <label className="tooling-field">
                    <span>Configuration name</span>
                    <input
                      className="auth-input"
                      type="text"
                      value={toolingFormData.name}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. Production export"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="tooling-field">
                    <span>Environment</span>
                    <select
                      className="auth-input"
                      value={toolingFormData.environment}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          environment: event.target.value,
                        }))
                      }
                    >
                      <option value="Production">Production</option>
                      <option value="Test">Test</option>
                      <option value="Development">Development</option>
                    </select>
                  </label>

                  <label className="tooling-field">
                    <span>Grant Type</span>
                    <input
                      className="auth-input"
                      type="text"
                      value="Client Credentials"
                      readOnly
                    />
                  </label>

                  <label className="tooling-field">
                    <span>Client ID</span>
                    <input
                      className="auth-input"
                      type="text"
                      autoComplete="off"
                      value={toolingFormData.clientId}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          clientId: event.target.value,
                        }))
                      }
                      placeholder="Enter OAuth Client ID"
                      maxLength={255}
                      required
                    />
                  </label>

                  <label className="tooling-field tooling-field-full">
                    <span>Client Secret</span>
                    <input
                      className="auth-input"
                      type="password"
                      autoComplete="new-password"
                      value={toolingFormData.clientSecret}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          clientSecret: event.target.value,
                        }))
                      }
                      placeholder={
                        editingToolingId && (
                          toolingConfigurations.find(
                            (item) => item.id === editingToolingId,
                          )?.has_secret
                        )
                          ? "Saved secret exists — enter a new one to replace it"
                          : "Enter OAuth Client Secret"
                      }
                      required={
                        !editingToolingId ||
                        !toolingConfigurations.some(
                          (item) =>
                            item.id === editingToolingId &&
                            item.has_secret,
                        )
                      }
                    />
                    <span className="auth-field-help">
                      {editingToolingId &&
                      toolingConfigurations.some(
                        (item) =>
                          item.id === editingToolingId &&
                          item.has_secret,
                      )
                        ? "Leave blank to keep the existing Vault secret. Enter a value only when replacing it."
                        : "The secret is required for a new configuration and will be sent to Supabase Vault."}
                    </span>
                  </label>

                  <label className="tooling-field tooling-field-full">
                    <span>Connection endpoint (optional)</span>
                    <input
                      className="auth-input"
                      type="url"
                      value={toolingFormData.endpoint}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          endpoint: event.target.value,
                        }))
                      }
                      placeholder="https://service.example.com"
                    />
                  </label>

                  <label className="tooling-field tooling-field-full">
                    <span>Description / notes</span>
                    <textarea
                      className="tooling-textarea"
                      value={toolingFormData.description}
                      onChange={(event) =>
                        setToolingFormData((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe when this configuration is used."
                      rows={3}
                      maxLength={1000}
                    />
                  </label>
                </div>

                <label className="tooling-enabled-field">
                  <input
                    type="checkbox"
                    checked={toolingFormData.enabled}
                    onChange={(event) =>
                      setToolingFormData((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  <span>Configuration enabled</span>
                </label>

                <div className="tooling-form-actions">
                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={closeToolingForm}
                    disabled={toolingSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="tooling-primary-button"
                    disabled={toolingSaving}
                  >
                    {toolingSaving
                      ? "Saving..."
                      : editingToolingId
                        ? "Save changes"
                        : "Add configuration"}
                  </button>
                </div>
              </form>
            )}

            {toolingConfigurations.length === 0 ? (
              <div className="tooling-empty-state">
                <div className="tooling-empty-icon">
                  <GenesysDevIcon
                    icon={GenesysDevIcons.AppDataSource}
                  />
                </div>
                <h3>No tooling configurations yet</h3>
                <p>
                  Add a profile to organise the connections used
                  by export services.
                </p>
                {!toolingFormOpen && (
                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={openNewToolingForm}
                  >
                    Add your first configuration
                  </button>
                )}
              </div>
            ) : (
              <div className="tooling-config-list">
                {toolingConfigurations.map((item) => (
                  <article
                    className="tooling-config-card"
                    key={item.id}
                  >
                    <div className="tooling-config-main">
                      <div className="tooling-config-icon">
                        <GenesysDevIcon
                          icon={GenesysDevIcons.AppDataSource}
                        />
                      </div>

                      <div className="tooling-config-copy">
                        <div className="tooling-config-title-row">
                          <h3>{item.name}</h3>
                          <span
                            className={`status-pill ${
                              item.enabled
                                ? "status-completed"
                                : "status-planned"
                            }`}
                          >
                            {item.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>

                        <span className="tooling-config-environment">
                          {item.environment}
                        </span>

                        <p>Grant Type: Client Credentials</p>

                        <p>
                          Client ID: {redactClientId(item.client_id)}
                        </p>

                        {item.description && <p>{item.description}</p>}
                      </div>
                    </div>

                    <div className="tooling-card-actions">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          disabled={toolingSaving}
                          onChange={() =>
                            void handleToggleTooling(item)
                          }
                          aria-label={`Enable ${item.name}`}
                        />
                        <span
                          className="settings-switch-track"
                          aria-hidden="true"
                        />
                        <span className="settings-switch-label">
                          {item.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </label>

                      <button
                        type="button"
                        className="tooling-secondary-button"
                        onClick={() => openEditToolingForm(item)}
                        disabled={toolingSaving}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="tooling-danger-button"
                        onClick={() =>
                          void handleRemoveTooling(item)
                        }
                        disabled={toolingSaving}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* =====================================================
          2. GENESYS CLOUD AUTHENTICATION
         ===================================================== */}
      <section className="panel tooling-panel">
        <div className="tooling-section-heading">
          <div>
            <h2 className="section-title">
              Genesys Cloud authentication
            </h2>
            <p className="section-description">
              Manage the optional Genesys OAuth configuration
              used by Genesys-powered features.
            </p>
          </div>

          {!integration && !integrationFormOpen && (
            <button
              type="button"
              className="tooling-primary-button"
              onClick={openNewIntegrationForm}
              disabled={integrationLoading || !standaloneUser}
            >
              + Add configuration
            </button>
          )}
        </div>

        <div className="tooling-notice">
          This configuration is separate from your Export
          Manager email login. A saved or enabled configuration
          does not necessarily mean an active Genesys session
          exists.
        </div>

        {integrationError && (
          <AlertBlock
            alertType="critical"
            title="Genesys authentication settings"
          >
            {integrationError}
          </AlertBlock>
        )}

        {integrationLoading ? (
          <p className="auth-description">
            Loading your saved Genesys configuration...
          </p>
        ) : !standaloneUser ? (
          <AlertBlock
            alertType="info"
            title="Export Manager account required"
          >
            Sign in with your Export Manager account to manage
            a personal Genesys authentication configuration.
          </AlertBlock>
        ) : (
          <>
            {integration && (
              <div className="tooling-config-list">
                <article className="tooling-config-card">
                  <div className="tooling-config-main">
                    <div className="tooling-config-icon">
                      <GenesysDevIcon
                        icon={GenesysDevIcons.AppShieldCheck}
                      />
                    </div>

                    <div className="tooling-config-copy">
                      <div className="tooling-config-title-row">
                        <h3>Genesys Cloud OAuth 2.0</h3>
                        <span
                          className={`status-pill ${
                            integration.enabled
                              ? "status-completed"
                              : "status-planned"
                          }`}
                        >
                          {integration.enabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>

                      <p>
                        Client ID: {redactClientId(integration.client_id)}
                      </p>
                    </div>
                  </div>

                  <div className="genesys-auth-card-actions">
                    <label className="settings-switch">
                      <input
                        type="checkbox"
                        checked={integration.enabled}
                        disabled={integrationSaving}
                        onChange={(event) =>
                          void handleToggleIntegration(
                            event.target.checked,
                          )
                        }
                        aria-label="Enable Genesys Cloud authentication"
                      />
                      <span
                        className="settings-switch-track"
                        aria-hidden="true"
                      />
                      <span className="settings-switch-label">
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>

                    <button
                      type="button"
                      className="tooling-secondary-button"
                      onClick={openEditIntegrationForm}
                      disabled={integrationSaving}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="tooling-danger-button"
                      onClick={() =>
                        void handleRemoveIntegration()
                      }
                      disabled={integrationSaving}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              </div>
            )}

            {!integration && !integrationFormOpen && (
              <div className="tooling-empty-state">
                <div className="tooling-empty-icon">
                  <GenesysDevIcon
                    icon={GenesysDevIcons.AppShieldCheck}
                  />
                </div>
                <h3>No Genesys authentication configured</h3>
                <p>
                  Configure Genesys OAuth details when you're
                  ready to enable Genesys-powered features.
                  Export Manager remains usable without this.
                </p>
                <button
                  type="button"
                  className="tooling-secondary-button"
                  onClick={openNewIntegrationForm}
                >
                  Configure Genesys authentication
                </button>
              </div>
            )}

            {integrationFormOpen && (
              <form
                className="tooling-form"
                onSubmit={handleSaveIntegration}
              >
                <h3 className="tooling-form-title">
                  {integration
                    ? "Edit Genesys authentication"
                    : "Add Genesys authentication"}
                </h3>

                <div className="tooling-form-grid">
                  <div className="tooling-field tooling-field-full">
                    <span>Login provider type</span>
                    <div className="config-value">
                      Genesys Cloud OAuth 2.0 — Authorization
                      Code with PKCE
                    </div>
                  </div>

                  <label className="tooling-field tooling-field-full">
                    <span>OAuth Client ID</span>
                    <input
                      className="auth-input"
                      type="text"
                      autoComplete="off"
                      value={integrationForm.clientId}
                      onChange={(event) =>
                        setIntegrationForm((current) => ({
                          ...current,
                          clientId: event.target.value,
                        }))
                      }
                      placeholder="Enter your Genesys OAuth Client ID"
                      maxLength={255}
                      required
                    />
                  </label>

                  <label className="tooling-field tooling-field-full">
                    <span>Genesys Cloud region</span>
                    <input
                      className="auth-input"
                      type="text"
                      value={integrationForm.region}
                      onChange={(event) =>
                        setIntegrationForm((current) => ({
                          ...current,
                          region: event.target.value,
                        }))
                      }
                      placeholder="mypurecloud.com.au"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="tooling-field tooling-field-full">
                    <span>OAuth redirect URI</span>
                    <input
                      className="auth-input"
                      type="url"
                      value={integrationForm.redirectUri}
                      onChange={(event) =>
                        setIntegrationForm((current) => ({
                          ...current,
                          redirectUri: event.target.value,
                        }))
                      }
                      placeholder="https://your-app.example.com/auth/genesys/callback"
                      maxLength={500}
                      required
                    />
                    <span className="auth-field-help">
                      This must match the registered Genesys OAuth
                      redirect URI. Callback handling will be
                      implemented separately.
                    </span>
                  </label>
                </div>

                <div className="tooling-form-actions">
                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={closeIntegrationForm}
                    disabled={integrationSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="tooling-primary-button"
                    disabled={integrationSaving}
                  >
                    {integrationSaving
                      ? "Saving..."
                      : integration
                        ? "Save changes"
                        : "Save configuration"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {/* =====================================================
          3. LOCAL ACCOUNT — LAST
         ===================================================== */}
      {standaloneUser && (
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="settings-title-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppUserSolid}
              />
            </div>
            <div>
              <h2 className="section-title">Local account</h2>
              <p className="section-description">
                Manage your Export Manager account and sign-in.
              </p>
            </div>
          </div>

          <div className="settings-config-list">
            <ConfigRow
              label="Email"
              value={standaloneUser.email || "Not available"}
            />
            <ConfigRow
              label="Name"
              value={standaloneProfile?.display_name || "Not set"}
            />
          </div>

          {signOutError && (
            <AlertBlock
              alertType="critical"
              title="Sign-out failed"
            >
              {signOutError}
            </AlertBlock>
          )}

          {accountDeleteError && (
            <AlertBlock
              alertType="critical"
              title="Account deletion failed"
            >
              {accountDeleteError}
            </AlertBlock>
          )}

          <div className="tooling-form-actions">
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </button>
          </div>

          <div className="account-danger-zone">
            <div>
              <h3>Delete account</h3>
              <p>
                Permanently delete your Export Manager account
                and associated records. This cannot be undone.
              </p>
            </div>

            <button
              type="button"
              className="tooling-danger-button"
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount}
            >
              {deletingAccount
                ? "Deleting account..."
                : "Delete account"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}