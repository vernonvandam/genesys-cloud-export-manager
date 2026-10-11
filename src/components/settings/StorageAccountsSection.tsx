import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import { supabase } from "../../lib/supabaseClient";

type StorageProvider =
  | "cloudflare-r2"
  | "google-cloud-storage"
  | "azure-blob"
  | "aws-s3"
  | "oracle-object-storage";
type StorageValue = string | boolean;
type StorageSettings = Record<string, StorageValue>;
type StorageCredentials = Record<string, string>;
type FieldSource = "settings" | "credentials";
type FieldKind = "text" | "password" | "textarea" | "select" | "url";
type FieldOption = { label: string; value: string };
type FieldSpec = {
  key: string;
  label: string;
  source: FieldSource;
  kind?: FieldKind;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  showWhen?: { key: string; value: string };
  fullWidth?: boolean;
};

type StorageAccount = {
  id: string;
  name: string;
  provider: StorageProvider;
  environment: string;
  enabled: boolean;
  description: string;
  settings: StorageSettings;
  credential_keys: string[];
  created_at: string;
  updated_at: string;
};

type StorageFormData = {
  name: string;
  provider: StorageProvider;
  environment: string;
  enabled: boolean;
  description: string;
  settings: StorageSettings;
  credentials: StorageCredentials;
};

const PROVIDER_LABELS: Record<StorageProvider, string> = {
  "cloudflare-r2": "Cloudflare R2",
  "google-cloud-storage": "Google Cloud Storage",
  "azure-blob": "Microsoft Azure Blob Storage",
  "aws-s3": "Amazon S3",
  "oracle-object-storage": "Oracle Cloud Infrastructure Object Storage",
};

const PROVIDER_LOGOS: Record<StorageProvider, string> = {
  "cloudflare-r2": "/images/storage-providers/cloudflare.svg",
  "google-cloud-storage": "/images/storage-providers/google-cloud.svg",
  "azure-blob": "/images/storage-providers/microsoft-azure.svg",
  "aws-s3": "/images/storage-providers/amazon-aws.svg",
  "oracle-object-storage": "/images/storage-providers/oracle-cloud.svg",
};

const DEFAULT_SETTINGS: Record<StorageProvider, StorageSettings> = {
  "cloudflare-r2": {
    accountId: "", bucketName: "", authMethod: "access-key",
  },
  "google-cloud-storage": {
    authMethod: "service-account-json", bucketName: "",
  },
  "azure-blob": {
    authMethod: "sas-token", storageAccountName: "", containerName: "",
  },
  "aws-s3": {
    authMethod: "access-keys", region: "", bucketName: "",
  },
  "oracle-object-storage": {
    authMethod: "api-key", region: "", namespaceName: "", bucketName: "",
    tenancyOcid: "", userOcid: "", fingerprint: "",
  },
};

/* Only fields required to locate an existing bucket/container and authenticate.
   Endpoint URLs are derived from the provider's standard endpoint convention. */
const PROVIDER_FIELDS: Record<StorageProvider, FieldSpec[]> = {
  "cloudflare-r2": [
    { key: "accountId", label: "Cloudflare account ID", source: "settings", required: true, placeholder: "Cloudflare account ID" },
    { key: "bucketName", label: "R2 bucket name", source: "settings", required: true, placeholder: "genesys-export-backups" },
    { key: "r2AccessKeyId", label: "R2 Access Key ID", source: "credentials", required: true, placeholder: "Enter Access Key ID" },
    { key: "r2SecretAccessKey", label: "R2 Secret Access Key", source: "credentials", kind: "password", required: true, placeholder: "Enter Secret Access Key" },
  ],
  "google-cloud-storage": [
    { key: "bucketName", label: "Storage bucket name", source: "settings", required: true, placeholder: "genesys-export-backups" },
    { key: "gcsServiceAccountJson", label: "Service account JSON key", source: "credentials", kind: "textarea", required: true, placeholder: "Paste the complete service account JSON key", help: "The service account must have object read, create/write, delete and list permissions on this existing bucket.", fullWidth: true },
  ],
  "azure-blob": [
    { key: "storageAccountName", label: "Storage account name", source: "settings", required: true, placeholder: "mystorageaccount" },
    { key: "containerName", label: "Blob container name", source: "settings", required: true, placeholder: "export-backups" },
    { key: "azureSasToken", label: "Container SAS token", source: "credentials", kind: "password", required: true, placeholder: "Paste SAS token (with or without leading ?)", help: "Use a container-scoped SAS with read, create, write, delete and list permissions (r, c, w, d, l).", fullWidth: true },
  ],
  "aws-s3": [
    { key: "region", label: "AWS Region", source: "settings", required: true, placeholder: "ap-southeast-2" },
    { key: "bucketName", label: "S3 bucket name", source: "settings", required: true, placeholder: "genesys-export-backups" },
    { key: "awsAccessKeyId", label: "AWS Access Key ID", source: "credentials", required: true, placeholder: "Enter Access Key ID" },
    { key: "awsSecretAccessKey", label: "AWS Secret Access Key", source: "credentials", kind: "password", required: true, placeholder: "Enter Secret Access Key" },
    { key: "awsSessionToken", label: "Session token (optional)", source: "credentials", kind: "password", placeholder: "Only for temporary credentials", fullWidth: true },
  ],
  "oracle-object-storage": [
    { key: "region", label: "OCI Region", source: "settings", required: true, placeholder: "ap-sydney-1" },
    { key: "namespaceName", label: "Object Storage namespace", source: "settings", required: true, placeholder: "Namespace shown in OCI tenancy details" },
    { key: "bucketName", label: "Bucket name", source: "settings", required: true, placeholder: "genesys-export-backups" },
    { key: "tenancyOcid", label: "Tenancy OCID", source: "settings", required: true, placeholder: "ocid1.tenancy..." },
    { key: "userOcid", label: "User OCID", source: "settings", required: true, placeholder: "ocid1.user..." },
    { key: "fingerprint", label: "API signing key fingerprint", source: "settings", required: true, placeholder: "12:34:56:..." },
    { key: "ociPrivateKeyPem", label: "Private key PEM", source: "credentials", kind: "textarea", required: true, placeholder: "Paste the complete PEM private key", help: "The OCI user must have permission to read, create, overwrite and delete objects in this existing bucket.", fullWidth: true },
    { key: "ociPrivateKeyPassphrase", label: "Private key passphrase (optional)", source: "credentials", kind: "password", placeholder: "Only if the private key is encrypted", fullWidth: true },
  ],
};

function blankForm(provider: StorageProvider = "cloudflare-r2"): StorageFormData {
  return {
    name: "",
    provider,
    environment: "Production",
    enabled: true,
    description: "",
    settings: { ...DEFAULT_SETTINGS[provider] },
    credentials: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProvider(value: unknown): value is StorageProvider {
  return typeof value === "string" && value in PROVIDER_LABELS;
}

function parseStorageAccount(value: unknown): StorageAccount {
  if (!isRecord(value) || !isProvider(value.provider) || !isRecord(value.settings)) {
    throw new Error("Supabase returned an invalid storage account record.");
  }
  if (
    typeof value.id !== "string" || typeof value.name !== "string" ||
    typeof value.environment !== "string" || typeof value.enabled !== "boolean" ||
    typeof value.description !== "string" || !Array.isArray(value.credential_keys) ||
    typeof value.created_at !== "string" || typeof value.updated_at !== "string"
  ) {
    throw new Error("Supabase returned an incomplete storage account record.");
  }
  const credentials = value.credential_keys.filter((key): key is string => typeof key === "string");
  const settings: StorageSettings = {};
  for (const [key, item] of Object.entries(value.settings)) {
    if (typeof item === "string" || typeof item === "boolean") settings[key] = item;
  }
  return { ...value, settings, credential_keys: credentials } as StorageAccount;
}

function settingText(settings: StorageSettings, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value : value === true ? "true" : value === false ? "false" : "";
}

function connectionSettings(provider: StorageProvider, source: StorageSettings): StorageSettings {
  const allowedKeys: Record<StorageProvider, string[]> = {
    "cloudflare-r2": ["accountId", "bucketName", "authMethod"],
    "google-cloud-storage": ["bucketName", "authMethod"],
    "azure-blob": ["storageAccountName", "containerName", "authMethod"],
    "aws-s3": ["region", "bucketName", "authMethod"],
    "oracle-object-storage": ["region", "namespaceName", "bucketName", "tenancyOcid", "userOcid", "fingerprint", "authMethod"],
  };
  const result: StorageSettings = { authMethod: DEFAULT_SETTINGS[provider].authMethod };
  for (const key of allowedKeys[provider]) {
    if (key === "authMethod") continue;
    const value = source[key];
    if (typeof value === "string" || typeof value === "boolean") result[key] = value;
  }
  return result;
}

function targetSummary(item: StorageAccount): string {
  if (item.provider === "cloudflare-r2" || item.provider === "aws-s3" || item.provider === "google-cloud-storage") {
    return settingText(item.settings, "bucketName");
  }
  if (item.provider === "azure-blob") {
    return `${settingText(item.settings, "storageAccountName")}/${settingText(item.settings, "containerName")}`;
  }
  return `${settingText(item.settings, "namespaceName")}/${settingText(item.settings, "bucketName")}`;
}

function requiredCredentialKeys(provider: StorageProvider): string[] {
  switch (provider) {
    case "cloudflare-r2": return ["r2AccessKeyId", "r2SecretAccessKey"];
    case "google-cloud-storage": return ["gcsServiceAccountJson"];
    case "azure-blob": return ["azureSasToken"];
    case "aws-s3": return ["awsAccessKeyId", "awsSecretAccessKey"];
    case "oracle-object-storage": return ["ociPrivateKeyPem"];
  }
}

export default function StorageAccountsSection() {
  const { user: standaloneUser } = useSupabaseAuth();
  const [accounts, setAccounts] = useState<StorageAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageFormData>(() => blankForm());
  const [formError, setFormError] = useState("");
  const [sectionError, setSectionError] = useState("");

  const fields = useMemo(() => PROVIDER_FIELDS[form.provider], [form.provider]);
  const loadAccounts = useCallback(async () => {
    setSectionError("");
    setLoading(true);
    try {
      if (!standaloneUser?.id) {
        setAccounts([]);
        return;
      }
      const { data, error } = await supabase.rpc("list_storage_accounts");
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error("Supabase returned an unexpected storage account list.");
      setAccounts(data.map(parseStorageAccount));
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : "Unable to load storage accounts.");
    } finally {
      setLoading(false);
    }
  }, [standaloneUser?.id]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  function openNewForm() {
    setEditingId(null);
    setForm(blankForm());
    setFormError("");
    setSectionError("");
    setFormOpen(true);
  }

  function openEditForm(item: StorageAccount) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      provider: item.provider,
      environment: item.environment,
      enabled: item.enabled,
      description: "",
      settings: connectionSettings(item.provider, item.settings),
      // Existing credentials are never loaded back from Vault into the browser.
      // Blank inputs mean "retain the saved value" when this form is saved.
      credentials: {},
    });
    setFormError("");
    setSectionError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(blankForm());
    setFormError("");
  }

  function updateSetting(key: string, value: StorageValue) {
    setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  function updateCredential(key: string, value: string) {
    setForm((current) => ({ ...current, credentials: { ...current.credentials, [key]: value } }));
  }

  function changeProvider(provider: StorageProvider) {
    setForm((current) => ({ ...current, provider, settings: { ...DEFAULT_SETTINGS[provider] }, credentials: {} }));
  }

  function validateForm(): string {
    if (!form.name.trim()) return "Enter a name for this storage account.";
    if (!standaloneUser?.id) return "Sign in to the Export Manager account before saving storage accounts.";

    for (const field of fields) {
      if (field.showWhen && settingText(form.settings, field.showWhen.key) !== field.showWhen.value) continue;
      if (!field.required) continue;
      if (field.source === "settings") {
        const value = settingText(form.settings, field.key).trim();
        if (!value) return `Enter ${field.label.toLowerCase()}.`;
      } else {
        const entered = (form.credentials[field.key] || "").trim();
        const alreadySaved = Boolean(editingId && accounts.find((item) => item.id === editingId)?.credential_keys.includes(field.key));
        if (!entered && !alreadySaved) return `Enter ${field.label.toLowerCase()}.`;
      }
    }

    const jsonValue = form.credentials.gcsServiceAccountJson?.trim();
    if (form.provider === "google-cloud-storage" && settingText(form.settings, "authMethod") === "service-account-json" && jsonValue) {
      try {
        const parsed: unknown = JSON.parse(jsonValue);
        if (!isRecord(parsed) || parsed.type !== "service_account" || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
          return "The Google credential JSON does not look like a service account key file.";
        }
      } catch {
        return "The Google service account credential must be valid JSON.";
      }
    }

    return "";
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSectionError("");

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      const visibleCredentialKeys = new Set(
        fields.filter((field) => field.source === "credentials" && (!field.showWhen || settingText(form.settings, field.showWhen.key) === field.showWhen.value)).map((field) => field.key),
      );
      const credentials: StorageCredentials = {};
      for (const [key, value] of Object.entries(form.credentials)) {
        if (visibleCredentialKeys.has(key) && value.trim()) credentials[key] = value;
      }

      const { data, error } = await supabase.rpc("save_storage_account", {
        p_id: editingId,
        p_name: form.name.trim(),
        p_provider: form.provider,
        p_environment: form.environment,
        p_enabled: form.enabled,
        p_description: "",
        p_settings: connectionSettings(form.provider, form.settings),
        p_credentials: credentials,
      });
      if (error) throw new Error(error.message);
      const saved = parseStorageAccount(data);
      setAccounts((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
      });
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save this storage account.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(item: StorageAccount) {
    if (saving) return;
    setSaving(true);
    setSectionError("");
    try {
      const { data, error } = await supabase.rpc("save_storage_account", {
        p_id: item.id,
        p_name: item.name,
        p_provider: item.provider,
        p_environment: item.environment,
        p_enabled: !item.enabled,
        p_description: item.description,
        p_settings: connectionSettings(item.provider, item.settings),
        p_credentials: {},
      });
      if (error) throw new Error(error.message);
      const updated = parseStorageAccount(data);
      setAccounts((current) => current.map((account) => account.id === updated.id ? updated : account));
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : "Unable to change the storage account state.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(item: StorageAccount) {
    if (!window.confirm(`Remove "${item.name}" and its stored provider credentials?`)) return;
    setSaving(true);
    setSectionError("");
    try {
      const { data, error } = await supabase.rpc("delete_storage_account", { p_id: item.id });
      if (error) throw new Error(error.message);
      if (data !== true) throw new Error("The storage account was not found or was already removed.");
      setAccounts((current) => current.filter((account) => account.id !== item.id));
      if (editingId === item.id) closeForm();
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : "Unable to remove this storage account.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: FieldSpec) {
    if (field.showWhen && settingText(form.settings, field.showWhen.key) !== field.showWhen.value) return null;
    const isCredential = field.source === "credentials";
    const value = isCredential ? (form.credentials[field.key] || "") : settingText(form.settings, field.key);
    const savedCredential = isCredential && Boolean(editingId && accounts.find((item) => item.id === editingId)?.credential_keys.includes(field.key));
    const required = Boolean(field.required && (!isCredential || !savedCredential));
    const className = `tooling-field${field.fullWidth ? " tooling-field-full" : ""}`;
    const common = {
      value,
      placeholder: field.placeholder || "",
      required,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (isCredential) updateCredential(field.key, event.target.value);
        else updateSetting(field.key, event.target.value);
      },
    };

    return (
      <label className={className} key={`${field.source}-${field.key}`}>
        <span>{field.label}{required ? " *" : ""}</span>
        {field.kind === "select" ? (
          <select {...common} className="auth-input">
            {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : field.kind === "textarea" ? (
          <textarea {...common} className="tooling-textarea" rows={field.key === "gcsServiceAccountJson" || field.key === "ociPrivateKeyPem" ? 6 : 3} autoComplete="new-password" />
        ) : (
          <input
            {...common}
            className="auth-input"
            type={field.kind === "password" ? "password" : field.kind === "url" ? "url" : "text"}
            autoComplete={isCredential ? "new-password" : "off"}
            spellCheck={false}
          />
        )}
        {field.help && <small className="storage-field-help">{field.help}</small>}
        {savedCredential && <small className="storage-field-help">A value is already stored securely. Leave this blank to keep it, or enter a replacement.</small>}
      </label>
    );
  }

  return (
    <section className="panel tooling-panel">
      <div className="tooling-section-heading">
        <div>
          <h2 className="section-title">Storage accounts</h2>
          <p className="section-description">Connect to existing buckets and containers for exported files and backups.</p>
        </div>
        <button type="button" className="tooling-primary-button" onClick={() => formOpen ? closeForm() : openNewForm()} disabled={saving}>
          {formOpen ? "Close form" : "+ Add storage account"}
        </button>
      </div>

      <div className="tooling-notice">
        This form connects to existing buckets and containers only; it never creates them. Credentials are stored in Supabase Vault and never returned to the browser. Grant only the permissions required to list, read, create/write and delete objects. Saving does not test the connection or upload files.
      </div>

      {!standaloneUser?.id && <AlertBlock alertType="critical" title="Sign in required">Sign in to your Export Manager account to load and save storage accounts.</AlertBlock>}
      {sectionError && <AlertBlock alertType="critical" title="Storage accounts">{sectionError}</AlertBlock>}
      {formError && <AlertBlock alertType="critical" title="Check the storage account form">{formError}</AlertBlock>}

      {formOpen && (
        <form className="tooling-form" onSubmit={saveConfiguration}>
          <h3 className="tooling-form-title">{editingId ? "Edit storage account" : "Add storage account"}</h3>
          <div className="tooling-form-grid">
            <label className="tooling-field">
              <span>Configuration name *</span>
              <input className="auth-input" type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Production export backups" maxLength={100} required />
            </label>
            <label className="tooling-field tooling-field-full">
              <span>Storage provider</span>
              <select className="auth-input" value={form.provider} disabled={Boolean(editingId)} onChange={(event) => changeProvider(event.target.value as StorageProvider)}>
                <option value="cloudflare-r2">Cloudflare R2</option>
                <option value="google-cloud-storage">Google Cloud Storage</option>
                <option value="azure-blob">Microsoft Azure Blob Storage</option>
                <option value="aws-s3">Amazon S3</option>
                <option value="oracle-object-storage">Oracle Cloud Infrastructure Object Storage</option>
              </select>
              {editingId && <small className="storage-field-help">Provider type is fixed after creation. Add another account to configure a different provider.</small>}
            </label>
            {fields.map((field) => renderField(field))}
          </div>

          <p className="storage-runtime-note">
            Ensure the credential has object read, create/write, delete and (where needed) list permissions for this existing destination. Permissions are granted in the provider console, not here.
          </p>

          <div className="tooling-form-actions">
            <button type="button" className="tooling-secondary-button" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" className="tooling-primary-button" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add storage account"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tooling-empty-state"><p>Loading storage accounts…</p></div>
      ) : accounts.length === 0 ? (
        <div className="tooling-empty-state">
          <div className="tooling-empty-icon"><GenesysDevIcon icon={GenesysDevIcons.AppDataSource} /></div>
          <h3>No storage accounts configured</h3>
          <p>Connect an existing bucket or container to define a destination for future exports and backups.</p>
          {!formOpen && <button type="button" className="tooling-secondary-button" onClick={openNewForm}>Add your first storage account</button>}
        </div>
      ) : (
        <div className="tooling-config-list">
          {accounts.map((item) => {
            const currentCredentialKeys = requiredCredentialKeys(item.provider);
            const hasRequiredCredentials = currentCredentialKeys.every((key) => item.credential_keys.includes(key));
            return (
              <article className="tooling-config-card" key={item.id}>
                <div className="tooling-config-main">
                  <div className="tooling-config-icon">
                    <img
                      src={PROVIDER_LOGOS[item.provider]}
                      alt=""
                      aria-hidden="true"
                      width={28}
                      height={28}
                      loading="lazy"
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                  <div className="tooling-config-copy">
                    <div className="tooling-config-title-row">
                      <h3>{item.name}</h3>
                      <span className={`status-pill ${item.enabled ? "status-completed" : "status-planned"}`}>{item.enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <span className="tooling-config-environment">{PROVIDER_LABELS[item.provider]}</span>
                    <p>Destination: {targetSummary(item) || "Not configured"}</p>
                    <p>Credentials: {hasRequiredCredentials ? "Credentials stored securely" : "Required credentials incomplete"}</p>
                  </div>
                </div>
                <div className="tooling-card-actions">
                  <label className="settings-switch">
                    <input type="checkbox" checked={item.enabled} onChange={() => void toggleAccount(item)} disabled={saving} aria-label={`Enable ${item.name}`} />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-label">{item.enabled ? "Enabled" : "Disabled"}</span>
                  </label>
                  <button type="button" className="tooling-secondary-button" onClick={() => openEditForm(item)} disabled={saving}>Edit</button>
                  <button type="button" className="tooling-danger-button" onClick={() => void removeAccount(item)} disabled={saving}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="section-heading section-heading-spaced">
        <div>
          <h2 className="section-title">Storage integrations</h2>
          <p className="section-description">
            Account configuration is available. Connection tests and automated
            export uploads will be implemented with the storage execution backend.
          </p>
        </div>
        <span className="placeholder-label">In development</span>
      </div>

      <div className="resource-placeholder-grid">
        {[
          { title: "Cloudflare R2", logoUrl: PROVIDER_LOGOS["cloudflare-r2"], description: "Connect to existing R2 buckets." },
          { title: "Google Cloud Storage", logoUrl: PROVIDER_LOGOS["google-cloud-storage"], description: "Connect to existing Cloud Storage buckets." },
          { title: "Microsoft Azure", logoUrl: PROVIDER_LOGOS["azure-blob"], description: "Connect to existing Blob Storage containers." },
          { title: "Amazon S3", logoUrl: PROVIDER_LOGOS["aws-s3"], description: "Connect to existing S3 buckets." },
          { title: "Oracle Cloud Infrastructure", logoUrl: PROVIDER_LOGOS["oracle-object-storage"], description: "Connect to existing OCI Object Storage buckets." },
        ].map((provider) => (
          <article className="resource-placeholder-card" key={provider.title}>
            <div className="resource-placeholder-icon">
              <img src={provider.logoUrl} alt="" aria-hidden="true" width={32} height={28} loading="lazy" style={{ objectFit: "contain" }} />
            </div>
            <span className="placeholder-label">Connection test planned</span>
            <h3>{provider.title}</h3>
            <p>{provider.description}</p>
            <span className="resource-placeholder-footer">Upload execution in development</span>
          </article>
        ))}
      </div>
    </section>
  );
}
