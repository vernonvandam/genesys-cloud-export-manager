import { useState } from "react";
import type { FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from "genesys-dev-icons";

type StorageProvider = "aws-s3" | "azure-blob";

type AzureAuthMethod =
  | "connection-string"
  | "sas-token"
  | "managed-identity";

type StorageConfiguration = {
  id: string;
  name: string;
  provider: StorageProvider;
  environment: string;
  enabled: boolean;
  awsRegion: string;
  bucketName: string;
  bucketPrefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  storageAccountName: string;
  containerName: string;
  azureAuthMethod: AzureAuthMethod;
  connectionString: string;
  sasToken: string;
  endpoint: string;
  description: string;
};

type StorageFormData = Omit<StorageConfiguration, "id">;

const EMPTY_FORM: StorageFormData = {
  name: "",
  provider: "aws-s3",
  environment: "Production",
  enabled: true,
  awsRegion: "",
  bucketName: "",
  bucketPrefix: "",
  accessKeyId: "",
  secretAccessKey: "",
  sessionToken: "",
  storageAccountName: "",
  containerName: "",
  azureAuthMethod: "connection-string",
  connectionString: "",
  sasToken: "",
  endpoint: "",
  description: "",
};

function redactAccessKey(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "Not configured";
  if (trimmed.length <= 8) return "[REDACTED]";

  return `${trimmed.slice(0, 4)}[REDACTED]${trimmed.slice(-4)}`;
}

/**
 * Storage account design prototype.
 *
 * The records and any credentials entered are held only in React
 * memory. Nothing is written to Supabase, localStorage or sessionStorage.
 * Refreshing the page clears this prototype data.
 */
export default function StorageAccountsSection() {
  const [configurations, setConfigurations] =
    useState<StorageConfiguration[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageFormData>({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");
  const [sectionError, setSectionError] = useState("");

  function openNewForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setSectionError("");
    setFormOpen(true);
  }

  function openEditForm(item: StorageConfiguration) {
    const { id, ...editable } = item;

    setEditingId(id);
    setForm({
      ...editable,
      // As with the tooling configuration form, don't show existing
      // secret values in the input. Blank values retain them on save.
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
      connectionString: "",
      sasToken: "",
    });
    setFormError("");
    setSectionError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  }

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSectionError("");

    const name = form.name.trim();
    if (!name) {
      setFormError("Enter a name for this storage configuration.");
      return;
    }

    const existing = configurations.find((item) => item.id === editingId);

    const accessKeyId =
      form.accessKeyId.trim() || existing?.accessKeyId || "";
    const secretAccessKey =
      form.secretAccessKey || existing?.secretAccessKey || "";
    const sessionToken =
      form.sessionToken || existing?.sessionToken || "";
    const connectionString =
      form.connectionString || existing?.connectionString || "";
    const sasToken = form.sasToken || existing?.sasToken || "";

    if (form.provider === "aws-s3") {
      if (!form.awsRegion.trim()) {
        setFormError("Enter the AWS Region.");
        return;
      }
      if (!form.bucketName.trim()) {
        setFormError("Enter the S3 bucket name.");
        return;
      }
      if (!accessKeyId || !secretAccessKey) {
        setFormError(
          "Enter an AWS Access Key ID and Secret Access Key. This prototype keeps credentials only in page memory.",
        );
        return;
      }
    } else {
      if (!form.storageAccountName.trim()) {
        setFormError("Enter the Azure Storage Account name.");
        return;
      }
      if (!form.containerName.trim()) {
        setFormError("Enter the Azure Blob container name.");
        return;
      }
      if (
        form.azureAuthMethod === "connection-string" &&
        !connectionString.trim()
      ) {
        setFormError("Enter the Azure connection string.");
        return;
      }
      if (
        form.azureAuthMethod === "sas-token" &&
        !sasToken.trim()
      ) {
        setFormError("Enter the Azure SAS token.");
        return;
      }
    }

    const saved: StorageConfiguration = {
      ...form,
      id: editingId || crypto.randomUUID(),
      name,
      awsRegion: form.awsRegion.trim(),
      bucketName: form.bucketName.trim(),
      bucketPrefix: form.bucketPrefix.trim(),
      accessKeyId,
      secretAccessKey,
      sessionToken,
      storageAccountName: form.storageAccountName.trim(),
      containerName: form.containerName.trim(),
      connectionString,
      sasToken,
      endpoint: form.endpoint.trim(),
      description: form.description.trim(),
    };

    setConfigurations((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? saved : item))
        : [saved, ...current],
    );

    closeForm();
  }

  function toggleConfiguration(item: StorageConfiguration) {
    setConfigurations((current) =>
      current.map((configuration) =>
        configuration.id === item.id
          ? { ...configuration, enabled: !configuration.enabled }
          : configuration,
      ),
    );
  }

  function removeConfiguration(item: StorageConfiguration) {
    const confirmed = window.confirm(
      `Remove the storage configuration "${item.name}" from this prototype session?`,
    );
    if (!confirmed) return;

    setConfigurations((current) =>
      current.filter((configuration) => configuration.id !== item.id),
    );

    if (editingId === item.id) closeForm();
    setSectionError("");
  }

  function updateForm<K extends keyof StorageFormData>(
    key: K,
    value: StorageFormData[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="panel tooling-panel">
      <div className="tooling-section-heading">
        <div>
          <h2 className="section-title">Storage accounts</h2>
          <p className="section-description">
            Configure AWS S3 and Azure Blob Storage destinations for
            future exports and backups.
          </p>
        </div>

        <button
          type="button"
          className="tooling-primary-button"
          onClick={() => (formOpen ? closeForm() : openNewForm())}
        >
          {formOpen ? "Close form" : "+ Add storage account"}
        </button>
      </div>

      <div className="tooling-notice">
        Design prototype only. Configurations and credentials entered here
        stay in page memory and are not saved to Supabase or browser storage.
        Reloading the page clears them. Connection tests and uploads are not
        implemented yet. Do not enter production secrets into this prototype.
      </div>

      {sectionError && (
        <AlertBlock alertType="critical" title="Storage accounts">
          {sectionError}
        </AlertBlock>
      )}

      {formError && (
        <AlertBlock
          alertType="critical"
          title="Check the storage account form"
        >
          {formError}
        </AlertBlock>
      )}

      {formOpen && (
        <form className="tooling-form" onSubmit={saveConfiguration}>
          <h3 className="tooling-form-title">
            {editingId ? "Edit storage account" : "Add storage account"}
          </h3>

          <div className="tooling-form-grid">
            <label className="tooling-field">
              <span>Configuration name</span>
              <input
                className="auth-input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="e.g. Production export backups"
                maxLength={100}
                required
              />
            </label>

            <label className="tooling-field">
              <span>Environment</span>
              <select
                className="auth-input"
                value={form.environment}
                onChange={(event) =>
                  updateForm("environment", event.target.value)
                }
              >
                <option value="Production">Production</option>
                <option value="Test">Test</option>
                <option value="Development">Development</option>
              </select>
            </label>

            <label className="tooling-field tooling-field-full">
              <span>Storage provider</span>
              <select
                className="auth-input"
                value={form.provider}
                onChange={(event) => {
                  const provider = event.target.value as StorageProvider;
                  setForm((current) => ({
                    ...current,
                    provider,
                    azureAuthMethod: "connection-string",
                  }));
                }}
              >
                <option value="aws-s3">Amazon Web Services — S3</option>
                <option value="azure-blob">
                  Microsoft Azure — Blob Storage
                </option>
              </select>
            </label>

            {form.provider === "aws-s3" ? (
              <>
                <label className="tooling-field">
                  <span>AWS Region</span>
                  <input
                    className="auth-input"
                    type="text"
                    value={form.awsRegion}
                    onChange={(event) =>
                      updateForm("awsRegion", event.target.value)
                    }
                    placeholder="e.g. ap-southeast-2"
                    required
                  />
                </label>

                <label className="tooling-field">
                  <span>S3 Bucket name</span>
                  <input
                    className="auth-input"
                    type="text"
                    value={form.bucketName}
                    onChange={(event) =>
                      updateForm("bucketName", event.target.value)
                    }
                    placeholder="my-export-backups"
                    required
                  />
                </label>

                <label className="tooling-field tooling-field-full">
                  <span>Object prefix / folder (optional)</span>
                  <input
                    className="auth-input"
                    type="text"
                    value={form.bucketPrefix}
                    onChange={(event) =>
                      updateForm("bucketPrefix", event.target.value)
                    }
                    placeholder="genesys-cloud/production/"
                  />
                </label>

                <label className="tooling-field">
                  <span>AWS Access Key ID</span>
                  <input
                    className="auth-input"
                    type="text"
                    autoComplete="off"
                    value={form.accessKeyId}
                    onChange={(event) =>
                      updateForm("accessKeyId", event.target.value)
                    }
                    placeholder={
                      editingId
                        ? "Leave blank to keep existing value"
                        : "Enter Access Key ID"
                    }
                    required={!editingId}
                  />
                </label>

                <label className="tooling-field">
                  <span>AWS Secret Access Key</span>
                  <input
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={form.secretAccessKey}
                    onChange={(event) =>
                      updateForm("secretAccessKey", event.target.value)
                    }
                    placeholder={
                      editingId
                        ? "Leave blank to keep existing secret"
                        : "Enter Secret Access Key"
                    }
                    required={!editingId}
                  />
                </label>

                <label className="tooling-field tooling-field-full">
                  <span>Session token (optional)</span>
                  <input
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={form.sessionToken}
                    onChange={(event) =>
                      updateForm("sessionToken", event.target.value)
                    }
                    placeholder={
                      editingId
                        ? "Leave blank to keep existing token"
                        : "Enter a temporary session token, if required"
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label className="tooling-field">
                  <span>Storage account name</span>
                  <input
                    className="auth-input"
                    type="text"
                    value={form.storageAccountName}
                    onChange={(event) =>
                      updateForm("storageAccountName", event.target.value)
                    }
                    placeholder="mystorageaccount"
                    required
                  />
                </label>

                <label className="tooling-field">
                  <span>Blob container name</span>
                  <input
                    className="auth-input"
                    type="text"
                    value={form.containerName}
                    onChange={(event) =>
                      updateForm("containerName", event.target.value)
                    }
                    placeholder="export-backups"
                    required
                  />
                </label>

                <label className="tooling-field tooling-field-full">
                  <span>Authentication method</span>
                  <select
                    className="auth-input"
                    value={form.azureAuthMethod}
                    onChange={(event) =>
                      updateForm(
                        "azureAuthMethod",
                        event.target.value as AzureAuthMethod,
                      )
                    }
                  >
                    <option value="connection-string">Connection string</option>
                    <option value="sas-token">
                      Shared Access Signature (SAS) token
                    </option>
                    <option value="managed-identity">
                      Managed identity (future option)
                    </option>
                  </select>
                </label>

                {form.azureAuthMethod === "connection-string" && (
                  <label className="tooling-field tooling-field-full">
                    <span>Azure connection string</span>
                    <input
                      className="auth-input"
                      type="password"
                      autoComplete="new-password"
                      value={form.connectionString}
                      onChange={(event) =>
                        updateForm("connectionString", event.target.value)
                      }
                      placeholder={
                        editingId
                          ? "Leave blank to keep existing connection string"
                          : "Enter Azure Storage connection string"
                      }
                      required={!editingId}
                    />
                  </label>
                )}

                {form.azureAuthMethod === "sas-token" && (
                  <label className="tooling-field tooling-field-full">
                    <span>Azure SAS token</span>
                    <input
                      className="auth-input"
                      type="password"
                      autoComplete="new-password"
                      value={form.sasToken}
                      onChange={(event) =>
                        updateForm("sasToken", event.target.value)
                      }
                      placeholder={
                        editingId
                          ? "Leave blank to keep existing SAS token"
                          : "Enter a container-scoped SAS token"
                      }
                      required={!editingId}
                    />
                  </label>
                )}

                {form.azureAuthMethod === "managed-identity" && (
                  <div className="tooling-field tooling-field-full">
                    <span>Managed identity</span>
                    <div className="config-value">
                      Template only. Runtime identity configuration will be
                      designed when storage integration is implemented.
                    </div>
                  </div>
                )}
              </>
            )}

            <label className="tooling-field tooling-field-full">
              <span>Custom endpoint (optional)</span>
              <input
                className="auth-input"
                type="url"
                value={form.endpoint}
                onChange={(event) => updateForm("endpoint", event.target.value)}
                placeholder="https://storage.example.com"
              />
            </label>

            <label className="tooling-field tooling-field-full">
              <span>Description / notes</span>
              <textarea
                className="tooling-textarea"
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                placeholder="Describe this destination and how it will be used."
                rows={3}
                maxLength={1000}
              />
            </label>
          </div>

          <label className="tooling-enabled-field">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => updateForm("enabled", event.target.checked)}
            />
            <span>Configuration enabled</span>
          </label>

          <div className="tooling-form-actions">
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={closeForm}
            >
              Cancel
            </button>

            <button type="submit" className="tooling-primary-button">
              {editingId ? "Save changes" : "Add storage account"}
            </button>
          </div>
        </form>
      )}

      {configurations.length === 0 ? (
        <div className="tooling-empty-state">
          <div className="tooling-empty-icon">
            <GenesysDevIcon icon={GenesysDevIcons.AppDataSource} />
          </div>
          <h3>No storage accounts configured</h3>
          <p>
            Add an AWS S3 bucket or Azure Blob Storage container to define
            a future export destination. This prototype previews the
            configuration experience only.
          </p>
          {!formOpen && (
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={openNewForm}
            >
              Add your first storage account
            </button>
          )}
        </div>
      ) : (
        <div className="tooling-config-list">
          {configurations.map((item) => {
            const isAws = item.provider === "aws-s3";

            return (
              <article className="tooling-config-card" key={item.id}>
                <div className="tooling-config-main">
                  <div className="tooling-config-icon">
                    <GenesysDevIcon icon={GenesysDevIcons.AppDataSource} />
                  </div>

                  <div className="tooling-config-copy">
                    <div className="tooling-config-title-row">
                      <h3>{item.name}</h3>
                      <span
                        className={
                          "status-pill " +
                          (item.enabled ? "status-completed" : "status-planned")
                        }
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <span className="tooling-config-environment">
                      {isAws ? "Amazon S3" : "Azure Blob Storage"} ·{" "}
                      {item.environment}
                    </span>

                    {isAws ? (
                      <>
                        <p>Bucket: {item.bucketName || "Not configured"}</p>
                        <p>Region: {item.awsRegion || "Not configured"}</p>
                        <p>
                          Access Key ID: {redactAccessKey(item.accessKeyId)}
                        </p>
                        <p>
                          Secret Access Key:{" "}
                          {item.secretAccessKey
                            ? "Configured in page memory"
                            : "Not configured"}
                        </p>
                        {item.bucketPrefix && <p>Prefix: {item.bucketPrefix}</p>}
                      </>
                    ) : (
                      <>
                        <p>
                          Storage account:{" "}
                          {item.storageAccountName || "Not configured"}
                        </p>
                        <p>
                          Container: {item.containerName || "Not configured"}
                        </p>
                        <p>
                          Authentication:{" "}
                          {item.azureAuthMethod === "connection-string"
                            ? "Connection string"
                            : item.azureAuthMethod === "sas-token"
                              ? "SAS token"
                              : "Managed identity"}
                        </p>
                        <p>
                          Credentials:{" "}
                          {item.azureAuthMethod === "connection-string"
                            ? item.connectionString
                              ? "Configured in page memory"
                              : "Not configured"
                            : item.azureAuthMethod === "sas-token"
                              ? item.sasToken
                                ? "Configured in page memory"
                                : "Not configured"
                              : "Managed identity template"}
                        </p>
                      </>
                    )}

                    {item.endpoint && <p>Endpoint: {item.endpoint}</p>}
                    {item.description && <p>{item.description}</p>}
                  </div>
                </div>

                <div className="tooling-card-actions">
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleConfiguration(item)}
                      aria-label={"Enable " + item.name}
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
                    onClick={() => openEditForm(item)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="tooling-danger-button"
                    onClick={() => removeConfiguration(item)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Other major providers follow the planned-card pattern used on Resources. */}
      <div className="section-heading section-heading-spaced">
        <div>
          <h2 className="section-title">Additional storage providers</h2>
          <p className="section-description">
            Other cloud object-storage destinations planned after the initial Cloudflare R2 integration.
          </p>
        </div>

        <span className="placeholder-label">Planned</span>
      </div>

      <div className="resource-placeholder-grid">
        {[
          {
            title: "Google Cloud Storage",
            description:
              "Connect Google Cloud Storage buckets for export packages, backup archives and retained versions.",
            logoUrl: "/images/storage-providers/google-cloud.svg",
            logoAlt: "Google Cloud logo",
            logoWidth: 28,
            logoHeight: 28,
          },
          {
            title: "Microsoft Azure",
            description:
              "Use Azure Blob Storage containers for configuration exports, backup packages and long-term retention.",
            logoUrl: "/images/storage-providers/microsoft-azure.svg",
            logoAlt: "Microsoft Azure logo",
            logoWidth: 28,
            logoHeight: 28,
          },
          {
            title: "Amazon Web Services (AWS)",
            description:
              "Add Amazon S3 buckets for export storage, backup archives and versioned objects.",
            logoUrl: "/images/storage-providers/amazon-aws.svg",
            logoAlt: "Amazon Web Services logo",
            logoWidth: 32,
            logoHeight: 24,
          },
          {
            title: "Oracle Cloud Infrastructure",
            description:
              "Add Oracle Cloud Infrastructure Object Storage as an alternative destination for exports and backup archives.",
            logoUrl: "/images/storage-providers/oracle-cloud.svg",
            logoAlt: "Oracle logo",
            logoWidth: 32,
            logoHeight: 22,
          },
        ].map((provider) => (
          <article
            className="resource-placeholder-card"
            key={provider.title}
          >
            <div className="resource-placeholder-icon">
              <img
                src={provider.logoUrl}
                alt={provider.logoAlt}
                width={provider.logoWidth}
                height={provider.logoHeight}
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ objectFit: "contain" }}
              />
            </div>

            <span className="placeholder-label">Coming soon</span>
            <h3>{provider.title}</h3>
            <p>{provider.description}</p>

            <span className="resource-placeholder-footer">
              Planned functionality
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
