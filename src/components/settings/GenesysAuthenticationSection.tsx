import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { useAuth } from "../../auth/useAuth";
import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import ConfigRow from "../common/ConfigRow";
import {
  deleteGenesysIntegration,
  getGenesysIntegration,
  saveGenesysIntegration,
  setGenesysIntegrationEnabled,
} from "../../lib/genesysIntegration";
import {
  getSavedGenesysIdentity,
  type GenesysIdentityLink,
} from "../../lib/genesysIdentity";
import type { GenesysIntegration } from "../../types/genesysIntegration";

type GenesysIntegrationFormData = {
  clientId: string;
  region: string;
  redirectUri: string;
};

function createDefaultGenesysForm(): GenesysIntegrationFormData {
  return {
    clientId: "",
    region: "mypurecloud.com.au",
    redirectUri: `${window.location.origin}/auth/genesys/callback`,
  };
}

function redactClientId(clientId: string | null | undefined): string {
  const value = clientId?.trim();
  if (!value) return "Not configured";
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 4)}[REDACTED]${value.slice(-4)}`;
}

export default function GenesysAuthenticationSection() {
  const {
    startGenesysLogin,
    disconnectGenesys,
    status: genesysAuthStatus,
    error: genesysAuthError,
  } = useAuth();
  const { user: standaloneUser } = useSupabaseAuth();

  const [integration, setIntegration] = useState<GenesysIntegration | null>(null);
  const [genesysIdentityLink, setGenesysIdentityLink] = useState<GenesysIdentityLink | null>(null);
  const [integrationForm, setIntegrationForm] = useState<GenesysIntegrationFormData>(createDefaultGenesysForm);
  const [integrationFormOpen, setIntegrationFormOpen] = useState(false);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationError, setIntegrationError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadIntegration() {
      setIntegration(null);
      setGenesysIdentityLink(null);

      if (!standaloneUser?.id) {
        setIntegrationForm(createDefaultGenesysForm());
        setIntegrationError("");
        setIntegrationLoading(false);
        return;
      }

      setIntegrationLoading(true);
      setIntegrationError("");
      try {
        const saved = await getGenesysIntegration(standaloneUser.id);
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

        // Keep the verified identity link when disabled; show it only while enabled.
        if (saved) {
          const identity = await getSavedGenesysIdentity(standaloneUser.id);
          if (active) setGenesysIdentityLink(identity);
        }
      } catch (error) {
        if (!active) return;
        setIntegrationError(
          error instanceof Error ? error.message : "Unable to load Genesys authentication settings.",
        );
      } finally {
        if (active) setIntegrationLoading(false);
      }
    }

    void loadIntegration();
    return () => {
      active = false;
    };
  }, [standaloneUser?.id]);

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

  async function handleSaveIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIntegrationError("");

    if (!standaloneUser?.id) {
      setIntegrationError("Sign in to your Export Manager account before saving this configuration.");
      return;
    }

    const clientId = integrationForm.clientId.trim();
    const region = integrationForm.region.trim();
    const redirectUri = integrationForm.redirectUri.trim();
    if (!clientId || !region || !redirectUri) {
      setIntegrationError("Client ID, region and redirect URI are required.");
      return;
    }

    try {
      const parsedRedirectUri = new URL(redirectUri);
      if (parsedRedirectUri.protocol !== "https:" && parsedRedirectUri.protocol !== "http:") {
        throw new Error("Unsupported URI protocol.");
      }
    } catch {
      setIntegrationError("Enter a valid HTTP or HTTPS redirect URI.");
      return;
    }

    const configurationUnchanged = Boolean(
      integration &&
        integration.client_id === clientId &&
        integration.region === region &&
        integration.redirect_uri === redirectUri,
    );

    setIntegrationSaving(true);
    try {
      const saved = await saveGenesysIntegration(standaloneUser.id, {
        client_id: clientId,
        region,
        redirect_uri: redirectUri,
        // Changed OAuth configuration must be authenticated again before enabling.
        enabled: Boolean(integration?.enabled && configurationUnchanged),
      });
      setIntegration(saved);
      setIntegrationForm({
        clientId: saved.client_id,
        region: saved.region,
        redirectUri: saved.redirect_uri,
      });
      if (!configurationUnchanged) disconnectGenesys();
      setIntegrationFormOpen(false);
    } catch (error) {
      setIntegrationError(
        error instanceof Error ? error.message : "Unable to save Genesys authentication settings.",
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  /** Enabling starts OAuth. Disabling keeps the saved verified identity link. */
  async function handleToggleIntegration(enabled: boolean) {
    if (!standaloneUser?.id || !integration || integrationSaving) return;
    setIntegrationError("");
    setIntegrationSaving(true);

    try {
      if (enabled) {
        await startGenesysLogin(
          {
            clientId: integration.client_id,
            region: integration.region,
            redirectUri: integration.redirect_uri,
          },
          true,
        );
        return;
      }

      // Update the database before clearing the current SDK state.
      const updated = await setGenesysIntegrationEnabled(standaloneUser.id, false);
      setIntegration(updated);
      disconnectGenesys();
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message
          : `Unable to ${enabled ? "enable" : "disable"} Genesys Cloud authentication.`,
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleRemoveIntegration() {
    if (!standaloneUser?.id || !integration || integrationSaving) return;
    const confirmed = window.confirm(
      "Remove the saved Genesys Cloud authentication configuration? Your Export Manager account will not be affected.",
    );
    if (!confirmed) return;

    setIntegrationError("");
    setIntegrationSaving(true);
    try {
      await deleteGenesysIntegration(standaloneUser.id);
      disconnectGenesys();
      setIntegration(null);
      setGenesysIdentityLink(null);
      setIntegrationForm(createDefaultGenesysForm());
      setIntegrationFormOpen(false);
    } catch (error) {
      setIntegrationError(
        error instanceof Error ? error.message : "Unable to remove Genesys authentication settings.",
      );
    } finally {
      setIntegrationSaving(false);
    }
  }

  return (
    <section className="panel tooling-panel">
      <div className="tooling-section-heading">
        <div>
          <h2 className="section-title">Genesys Cloud authentication</h2>
          <p className="section-description">
            Manage the optional Genesys OAuth configuration used by Genesys-powered features.
          </p>
        </div>
        {!integration && !integrationFormOpen && (
          <button type="button" className="tooling-primary-button" onClick={openNewIntegrationForm}
            disabled={integrationLoading || !standaloneUser}>
            + Add configuration
          </button>
        )}
      </div>

      <div className="tooling-notice">
        This configuration is separate from your Export Manager email login. Disabling the integration clears the application SDK session, but does not necessarily sign you out of a separate Genesys Cloud browser session.
      </div>

      {(integrationError || (genesysAuthStatus === "Authentication failed" ? genesysAuthError : "")) && (
        <AlertBlock alertType="critical" title="Genesys authentication settings">
          {integrationError || genesysAuthError || "Genesys Cloud authentication failed."}
        </AlertBlock>
      )}

      {integrationLoading ? (
        <p className="auth-description">Loading your saved Genesys configuration...</p>
      ) : !standaloneUser ? (
        <AlertBlock alertType="info" title="Export Manager account required">
          Sign in with your Export Manager account to manage a personal Genesys authentication configuration.
        </AlertBlock>
      ) : (
        <>
          {integration && (
            <div className="tooling-config-list">
              <article className="tooling-config-card">
                <div className="tooling-config-main">
                  <div className="tooling-config-icon"><GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} /></div>
                  <div className="tooling-config-copy">
                    <div className="tooling-config-title-row">
                      <h3>Genesys Cloud OAuth 2.0</h3>
                      <span className={`status-pill ${integration.enabled ? "status-completed" : "status-planned"}`}>
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p>Client ID: {redactClientId(integration.client_id)}</p>
                    {integration.enabled && (
                      <>
                        <ConfigRow label="Genesys organisation"
                          value={genesysIdentityLink?.organization_name || genesysIdentityLink?.organization_id || "Not available"} />
                        <ConfigRow label="Logged in Genesys user"
                          value={genesysIdentityLink?.genesys_name || genesysIdentityLink?.genesys_username || genesysIdentityLink?.genesys_email || "Not available"} />
                      </>
                    )}
                  </div>
                </div>
                <div className="genesys-auth-card-actions">
                  <label className="settings-switch">
                    <input type="checkbox" checked={integration.enabled} disabled={integrationSaving}
                      onChange={(event) => void handleToggleIntegration(event.target.checked)}
                      aria-label="Enable Genesys Cloud authentication" />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-label">{integration.enabled ? "Enabled" : "Disabled"}</span>
                  </label>
                  <button type="button" className="tooling-secondary-button" onClick={openEditIntegrationForm} disabled={integrationSaving}>Edit</button>
                  <button type="button" className="tooling-danger-button" onClick={() => void handleRemoveIntegration()} disabled={integrationSaving}>Remove</button>
                </div>
              </article>
            </div>
          )}

          {!integration && !integrationFormOpen && (
            <div className="tooling-empty-state">
              <div className="tooling-empty-icon"><GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} /></div>
              <h3>No Genesys authentication configured</h3>
              <p>Configure Genesys OAuth details when you're ready to enable Genesys-powered features. Export Manager remains usable without this.</p>
              <button type="button" className="tooling-secondary-button" onClick={openNewIntegrationForm}>Configure Genesys authentication</button>
            </div>
          )}

          {integrationFormOpen && (
            <form className="tooling-form" onSubmit={handleSaveIntegration}>
              <h3 className="tooling-form-title">{integration ? "Edit Genesys authentication" : "Add Genesys authentication"}</h3>
              <div className="tooling-form-grid">
                <div className="tooling-field tooling-field-full">
                  <span>Login provider type</span>
                  <div className="config-value">Genesys Cloud OAuth 2.0 — Authorization Code with PKCE</div>
                </div>
                <label className="tooling-field tooling-field-full">
                  <span>OAuth Client ID</span>
                  <input className="auth-input" type="text" autoComplete="off" value={integrationForm.clientId}
                    onChange={(event) => setIntegrationForm((current) => ({ ...current, clientId: event.target.value }))}
                    placeholder="Enter your Genesys OAuth Client ID" maxLength={255} required />
                </label>
                <label className="tooling-field tooling-field-full">
                  <span>Genesys Cloud region</span>
                  <input className="auth-input" type="text" value={integrationForm.region}
                    onChange={(event) => setIntegrationForm((current) => ({ ...current, region: event.target.value }))}
                    placeholder="mypurecloud.com.au" maxLength={100} required />
                </label>
                <label className="tooling-field tooling-field-full">
                  <span>OAuth redirect URI</span>
                  <input className="auth-input" type="url" value={integrationForm.redirectUri}
                    onChange={(event) => setIntegrationForm((current) => ({ ...current, redirectUri: event.target.value }))}
                    placeholder="https://your-app.example.com/auth/genesys/callback" maxLength={500} required />
                  <span className="auth-field-help">This must exactly match the registered Genesys OAuth redirect URI.</span>
                </label>
              </div>
              <div className="tooling-form-actions">
                <button type="button" className="tooling-secondary-button" onClick={closeIntegrationForm} disabled={integrationSaving}>Cancel</button>
                <button type="submit" className="tooling-primary-button" disabled={integrationSaving}>
                  {integrationSaving ? "Saving..." : integration ? "Save changes" : "Save configuration"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
