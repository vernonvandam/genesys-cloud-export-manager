import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import { useAuth } from "../../auth/useAuth";
import { callOrgRpc } from "../../lib/orgData";
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

type FieldOption = {
  label: string;
  value: string;
};

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

type TestStepKey = "connect" | "upload" | "edit" | "delete";

type TestStepStatus = "pending" | "running" | "passed" | "failed";

type StorageTestStep = {
  key: TestStepKey;
  label: string;
  status: TestStepStatus;
  message: string;
  durationMs?: number;
};

type StorageTestLogSummary = {
  id: string;
  storage_account_id: string;
  status: "passed" | "failed";
  finished_at: string;
};

type StorageTestCompleteEvent = {
  passed: boolean;
  status: "passed" | "failed";
  logId: string | null;
  message: string;
};

type StorageTestStageEvent = {
  key: TestStepKey;
  status: TestStepStatus;
  message: string;
  durationMs?: number;
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
    accountId: "",
    bucketName: "",
    authMethod: "access-key",
  },
  "google-cloud-storage": {
    authMethod: "service-account-json",
    bucketName: "",
  },
  "azure-blob": {
    authMethod: "sas-token",
    storageAccountName: "",
    containerName: "",
  },
  "aws-s3": {
    authMethod: "access-keys",
    region: "",
    bucketName: "",
  },
  "oracle-object-storage": {
    authMethod: "api-key",
    region: "",
    namespaceName: "",
    bucketName: "",
    tenancyOcid: "",
    userOcid: "",
    fingerprint: "",
  },
};

/*
 * Only fields required to locate an existing bucket/container
 * and authenticate. Endpoint URLs are derived from standard
 * provider endpoint conventions.
 */
const PROVIDER_FIELDS: Record<StorageProvider, FieldSpec[]> = {
  "cloudflare-r2": [
    {
      key: "accountId",
      label: "Cloudflare account ID",
      source: "settings",
      required: true,
      placeholder: "Cloudflare account ID",
    },
    {
      key: "bucketName",
      label: "R2 bucket name",
      source: "settings",
      required: true,
      placeholder: "genesys-export-backups",
    },
    {
      key: "r2AccessKeyId",
      label: "R2 Access Key ID",
      source: "credentials",
      required: true,
      placeholder: "Enter Access Key ID",
    },
    {
      key: "r2SecretAccessKey",
      label: "R2 Secret Access Key",
      source: "credentials",
      kind: "password",
      required: true,
      placeholder: "Enter Secret Access Key",
    },
  ],

  "google-cloud-storage": [
    {
      key: "bucketName",
      label: "Storage bucket name",
      source: "settings",
      required: true,
      placeholder: "genesys-export-backups",
    },
    {
      key: "gcsServiceAccountJson",
      label: "Service account JSON key",
      source: "credentials",
      kind: "textarea",
      required: true,
      placeholder: "Paste the complete service account JSON key",
      help:
        "The service account must have object read, create/write, " +
        "delete and list permissions on this existing bucket.",
      fullWidth: true,
    },
  ],

  "azure-blob": [
    {
      key: "storageAccountName",
      label: "Storage account name",
      source: "settings",
      required: true,
      placeholder: "mystorageaccount",
    },
    {
      key: "containerName",
      label: "Blob container name",
      source: "settings",
      required: true,
      placeholder: "export-backups",
    },
    {
      key: "azureSasToken",
      label: "Container SAS token",
      source: "credentials",
      kind: "password",
      required: true,
      placeholder: "Paste SAS token (with or without leading ?)",
      help:
        "Use a container-scoped SAS with read, create, write, " +
        "delete and list permissions (r, c, w, d, l).",
      fullWidth: true,
    },
  ],

  "aws-s3": [
    {
      key: "region",
      label: "AWS Region",
      source: "settings",
      required: true,
      placeholder: "ap-southeast-2",
    },
    {
      key: "bucketName",
      label: "S3 bucket name",
      source: "settings",
      required: true,
      placeholder: "genesys-export-backups",
    },
    {
      key: "awsAccessKeyId",
      label: "AWS Access Key ID",
      source: "credentials",
      required: true,
      placeholder: "Enter Access Key ID",
    },
    {
      key: "awsSecretAccessKey",
      label: "AWS Secret Access Key",
      source: "credentials",
      kind: "password",
      required: true,
      placeholder: "Enter Secret Access Key",
    },
    {
      key: "awsSessionToken",
      label: "Session token (optional)",
      source: "credentials",
      kind: "password",
      placeholder: "Only for temporary credentials",
      fullWidth: true,
    },
  ],

  "oracle-object-storage": [
    {
      key: "region",
      label: "OCI Region",
      source: "settings",
      required: true,
      placeholder: "ap-sydney-1",
    },
    {
      key: "namespaceName",
      label: "Object Storage namespace",
      source: "settings",
      required: true,
      placeholder: "Namespace shown in OCI tenancy details",
    },
    {
      key: "bucketName",
      label: "Bucket name",
      source: "settings",
      required: true,
      placeholder: "genesys-export-backups",
    },
    {
      key: "tenancyOcid",
      label: "Tenancy OCID",
      source: "settings",
      required: true,
      placeholder: "ocid1.tenancy...",
    },
    {
      key: "userOcid",
      label: "User OCID",
      source: "settings",
      required: true,
      placeholder: "ocid1.user...",
    },
    {
      key: "fingerprint",
      label: "API signing key fingerprint",
      source: "settings",
      required: true,
      placeholder: "12:34:56:...",
    },
    {
      key: "ociPrivateKeyPem",
      label: "Private key PEM",
      source: "credentials",
      kind: "textarea",
      required: true,
      placeholder: "Paste the complete PEM private key",
      help:
        "The OCI user must have permission to read, create, " +
        "overwrite and delete objects in this existing bucket.",
      fullWidth: true,
    },
    {
      key: "ociPrivateKeyPassphrase",
      label: "Private key passphrase (optional)",
      source: "credentials",
      kind: "password",
      placeholder: "Only if the private key is encrypted",
      fullWidth: true,
    },
  ],
};

const TEST_STEP_DEFINITIONS: StorageTestStep[] = [
  {
    key: "connect",
    label: "Connect to storage",
    status: "pending",
    message: "Waiting to start.",
  },
  {
    key: "upload",
    label: "Upload and read dummy file",
    status: "pending",
    message: "Waiting to start.",
  },
  {
    key: "edit",
    label: "Edit and verify dummy file",
    status: "pending",
    message: "Waiting to start.",
  },
  {
    key: "delete",
    label: "Delete and verify removal",
    status: "pending",
    message: "Waiting to start.",
  },
];

function blankForm(
  provider: StorageProvider = "cloudflare-r2",
): StorageFormData {
  return {
    name: "",
    provider,
    environment: "Production",
    enabled: false,
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
  if (
    !isRecord(value) ||
    !isProvider(value.provider) ||
    !isRecord(value.settings)
  ) {
    throw new Error("Supabase returned an invalid storage account record.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.environment !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.description !== "string" ||
    !Array.isArray(value.credential_keys) ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error("Supabase returned an incomplete storage account record.");
  }

  const credentials = value.credential_keys.filter(
    (key): key is string => typeof key === "string",
  );

  const settings: StorageSettings = {};

  for (const [key, item] of Object.entries(value.settings)) {
    if (typeof item === "string" || typeof item === "boolean") {
      settings[key] = item;
    }
  }

  return {
    ...value,
    settings,
    credential_keys: credentials,
  } as StorageAccount;
}

function settingText(settings: StorageSettings, key: string): string {
  const value = settings[key];

  return typeof value === "string"
    ? value
    : value === true
      ? "true"
      : value === false
        ? "false"
        : "";
}

function connectionSettings(
  provider: StorageProvider,
  source: StorageSettings,
): StorageSettings {
  const allowedKeys: Record<StorageProvider, string[]> = {
    "cloudflare-r2": ["accountId", "bucketName", "authMethod"],
    "google-cloud-storage": ["bucketName", "authMethod"],
    "azure-blob": ["storageAccountName", "containerName", "authMethod"],
    "aws-s3": ["region", "bucketName", "authMethod"],
    "oracle-object-storage": [
      "region",
      "namespaceName",
      "bucketName",
      "tenancyOcid",
      "userOcid",
      "fingerprint",
      "authMethod",
    ],
  };

  const result: StorageSettings = {
    authMethod: DEFAULT_SETTINGS[provider].authMethod,
  };

  for (const key of allowedKeys[provider]) {
    if (key === "authMethod") continue;

    const value = source[key];

    if (typeof value === "string" || typeof value === "boolean") {
      result[key] = value;
    }
  }

  return result;
}

function targetSummary(item: StorageAccount): string {
  if (
    item.provider === "cloudflare-r2" ||
    item.provider === "aws-s3" ||
    item.provider === "google-cloud-storage"
  ) {
    return settingText(item.settings, "bucketName");
  }

  if (item.provider === "azure-blob") {
    return (
      `${settingText(item.settings, "storageAccountName")}/` +
      settingText(item.settings, "containerName")
    );
  }

  return (
    `${settingText(item.settings, "namespaceName")}/` +
    settingText(item.settings, "bucketName")
  );
}

function requiredCredentialKeys(provider: StorageProvider): string[] {
  switch (provider) {
    case "cloudflare-r2":
      return ["r2AccessKeyId", "r2SecretAccessKey"];

    case "google-cloud-storage":
      return ["gcsServiceAccountJson"];

    case "azure-blob":
      return ["azureSasToken"];

    case "aws-s3":
      return ["awsAccessKeyId", "awsSecretAccessKey"];

    case "oracle-object-storage":
      return ["ociPrivateKeyPem"];
  }
}

function copyTestSteps(): StorageTestStep[] {
  return TEST_STEP_DEFINITIONS.map((step) => ({ ...step }));
}

export default function StorageAccountsSection() {
  const { user: standaloneUser, activeOrganizationId } = useSupabaseAuth();
  const {
    mode,
    user: genesysUser,
    organization,
    accessToken,
    config,
  } = useAuth();
  const organizationId =
    mode === "integrated" ? organization?.id ?? null : activeOrganizationId;
  const integrated = useMemo(
    () =>
      mode === "integrated" && accessToken
        ? { accessToken, region: config.region }
        : undefined,
    [mode, accessToken, config.region],
  );
  const hasSession =
    mode === "integrated" ? Boolean(genesysUser) : Boolean(standaloneUser);

  const [accounts, setAccounts] = useState<StorageAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageFormData>(() => blankForm());

  const [formError, setFormError] = useState("");
  const [sectionError, setSectionError] = useState("");

  const [latestTests, setLatestTests] = useState<
    Record<string, StorageTestLogSummary>
  >({});

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingAccount, setTestingAccount] = useState<StorageAccount | null>(
    null,
  );

  const [testSteps, setTestSteps] =
    useState<StorageTestStep[]>(copyTestSteps());

  const [testRunning, setTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "running" | "passed" | "failed"
  >("idle");

  const [testMessage, setTestMessage] = useState("");
  const [testLogId, setTestLogId] = useState<string | null>(null);
  const [testWillEnable, setTestWillEnable] = useState(false);

  const fields = useMemo(() => PROVIDER_FIELDS[form.provider], [form.provider]);

  /*
   * Load the most recent test report for each account.
   * RLS on storage_account_test_logs must restrict rows to
   * the authenticated user's own records.
   */
  const loadTestLogs = useCallback(async () => {
    if (!hasSession || !organizationId) {
      setLatestTests({});
      return;
    }

    const { data, error } = await callOrgRpc<unknown[]>(
      "list_storage_account_test_logs",
      { p_organization_id: organizationId },
      integrated,
    );

    if (error) {
      setSectionError(`Unable to load storage test results: ${error.message}`);
      return;
    }

    const latest: Record<string, StorageTestLogSummary> = {};

    for (const value of data ?? []) {
      const row = value as StorageTestLogSummary;
      if (!latest[row.storage_account_id]) {
        latest[row.storage_account_id] = row;
      }
    }

    setLatestTests(latest);
  }, [hasSession, organizationId, integrated]);

  const loadAccounts = useCallback(async () => {
    setSectionError("");
    setLoading(true);

    try {
      if (!hasSession || !organizationId) {
        setAccounts([]);
        setLatestTests({});
        return;
      }

      const { data, error } = await callOrgRpc<unknown[]>(
        "list_storage_accounts",
        { p_organization_id: organizationId },
        integrated,
      );

      if (error) throw new Error(error.message);

      if (!Array.isArray(data)) {
        throw new Error(
          "Supabase returned an unexpected storage account list.",
        );
      }

      setAccounts(data.map(parseStorageAccount));
      await loadTestLogs();
    } catch (error) {
      setSectionError(
        error instanceof Error
          ? error.message
          : "Unable to load storage accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, [hasSession, organizationId, integrated, loadTestLogs]);

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
      description: item.description,
      settings: connectionSettings(item.provider, item.settings),

      /*
       * Existing credentials are never loaded back from Vault
       * into the browser. Blank values mean "retain the saved
       * value" when this form is saved.
       */
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
    setForm((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }));
  }

  function updateCredential(key: string, value: string) {
    setForm((current) => ({
      ...current,
      credentials: {
        ...current.credentials,
        [key]: value,
      },
    }));
  }

  function changeProvider(provider: StorageProvider) {
    setForm((current) => ({
      ...current,
      provider,
      settings: { ...DEFAULT_SETTINGS[provider] },
      credentials: {},
    }));
  }

  function validateForm(): string {
    if (!form.name.trim()) {
      return "Enter a name for this storage account.";
    }

    if (!hasSession || !organizationId) {
      return (
        "Sign in to the Export Manager account before " +
        "saving storage accounts."
      );
    }

    for (const field of fields) {
      if (
        field.showWhen &&
        settingText(form.settings, field.showWhen.key) !== field.showWhen.value
      ) {
        continue;
      }

      if (!field.required) continue;

      if (field.source === "settings") {
        const value = settingText(form.settings, field.key).trim();

        if (!value) {
          return `Enter ${field.label.toLowerCase()}.`;
        }
      } else {
        const entered = (form.credentials[field.key] || "").trim();

        const alreadySaved = Boolean(
          editingId &&
          accounts
            .find((item) => item.id === editingId)
            ?.credential_keys.includes(field.key),
        );

        if (!entered && !alreadySaved) {
          return `Enter ${field.label.toLowerCase()}.`;
        }
      }
    }

    const jsonValue = form.credentials.gcsServiceAccountJson?.trim();

    if (
      form.provider === "google-cloud-storage" &&
      settingText(form.settings, "authMethod") === "service-account-json" &&
      jsonValue
    ) {
      try {
        const parsed: unknown = JSON.parse(jsonValue);

        if (
          !isRecord(parsed) ||
          parsed.type !== "service_account" ||
          typeof parsed.client_email !== "string" ||
          typeof parsed.private_key !== "string"
        ) {
          return (
            "The Google credential JSON does not look like " +
            "a service account key file."
          );
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
        fields
          .filter(
            (field) =>
              field.source === "credentials" &&
              (!field.showWhen ||
                settingText(form.settings, field.showWhen.key) ===
                  field.showWhen.value),
          )
          .map((field) => field.key),
      );

      const credentials: StorageCredentials = {};

      for (const [key, value] of Object.entries(form.credentials)) {
        if (visibleCredentialKeys.has(key) && value.trim()) {
          credentials[key] = value;
        }
      }

      const { data, error } = await callOrgRpc<unknown>("save_storage_account", {
        p_id: editingId,
        p_organization_id: organizationId,
        p_name: form.name.trim(),
        p_provider: form.provider,
        p_environment: form.environment,

        // New accounts must always start disabled.
        // Editing preserves the current status.
        p_enabled: editingId ? form.enabled : false,

        p_description: form.description.trim(),
        p_settings: connectionSettings(form.provider, form.settings),
        p_credentials: credentials,
      }, integrated);

      if (error) throw new Error(error.message);

      const saved = parseStorageAccount(data);

      setAccounts((current) => {
        const exists = current.some((item) => item.id === saved.id);

        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });

      closeForm();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save this storage account.",
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Download a JSON test report. The RLS policy on the report
   * table is responsible for restricting downloads to the
   * authenticated owner.
   */
  async function downloadTestReport(logId: string) {
    try {
      const { data, error } = await callOrgRpc<unknown>(
        "get_storage_account_test_log",
        { p_id: logId, p_organization_id: organizationId },
        integrated,
      );

      if (error) throw new Error(error.message);
      if (
        !isRecord(data) ||
        !isRecord(data.report) ||
        typeof data.storage_account_name !== "string"
      ) {
        throw new Error("Supabase returned an invalid storage test report.");
      }

      const blob = new Blob([JSON.stringify(data.report, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      const safeName = data.storage_account_name
        .replace(/[^a-z0-9-_]/gi, "-")
        .toLowerCase();

      anchor.href = url;
      anchor.download = `storage-test-${safeName}-${logId}.json`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      setSectionError(
        error instanceof Error
          ? error.message
          : "Unable to download the test report.",
      );
    }
  }

  /*
   * Start the real connectivity test. Progress comes from
   * Server-Sent Events emitted by the Supabase Edge Function.
   *
   * If enableAfterSuccess is true, the account is enabled only
   * after the server reports every stage passed and confirms
   * that the test report was saved.
   */
  async function runStorageTest(
    item: StorageAccount,
    enableAfterSuccess = false,
  ) {
    if (testRunning || saving) return;

    setTestingAccount(item);
    setTestWillEnable(enableAfterSuccess);
    setTestModalOpen(true);

    setTestSteps(copyTestSteps());
    setTestStatus("running");
    setTestMessage("Starting connectivity test...");
    setTestLogId(null);
    setTestRunning(true);

    try {
      let bearerToken = accessToken;
      if (mode !== "integrated") {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error(
            "Your session has expired. Sign in again before testing storage.",
          );
        }
        bearerToken = session.access_token;
      }
      if (!bearerToken) {
        throw new Error(
          "Your session has expired. Sign in again before testing storage.",
        );
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as
        | string
        | undefined;

      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
        | string
        | undefined;

      if (!supabaseUrl || !publishableKey) {
        throw new Error("Supabase configuration is missing.");
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/test-storage-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
            apikey: publishableKey,
          },
          body: JSON.stringify({
            storageAccountId: item.id,
            organizationId,
            ...(mode === "integrated" ? { region: config.region } : {}),
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.error ??
            `The connectivity test returned HTTP ${response.status}.`,
        );
      }

      if (!response.body) {
        throw new Error("The server did not return test progress.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      /*
       * Keep the final event in a mutable holder because it
       * is assigned inside the SSE event handler.
       */
      const received: {
        complete?: StorageTestCompleteEvent;
      } = {};

      function handleEvent(raw: string) {
        for (const line of raw.split(/\r?\n/)) {
          if (!line.startsWith("data: ")) continue;

          let event: Record<string, unknown>;

          try {
            const parsed: unknown = JSON.parse(line.slice(6));

            if (!isRecord(parsed)) continue;

            event = parsed;
          } catch {
            continue;
          }

          if (event.type === "stage") {
            const stage = event as unknown as {
              type: "stage";
            } & StorageTestStageEvent;

            setTestSteps((current) =>
              current.map((step) =>
                step.key === stage.key
                  ? {
                      ...step,
                      status: stage.status,
                      message: stage.message,
                      durationMs: stage.durationMs,
                    }
                  : step,
              ),
            );
          }

          if (event.type === "complete") {
            received.complete = event as unknown as StorageTestCompleteEvent;
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, {
            stream: !done,
          });
        } else if (done) {
          buffer += decoder.decode();
        }

        const sections = buffer.split(/\r?\n\r?\n/);

        buffer = sections.pop() ?? "";

        for (const section of sections) {
          handleEvent(section);
        }

        if (done) break;
      }

      if (buffer.trim()) {
        handleEvent(buffer);
      }

      const result = received.complete;

      if (!result) {
        throw new Error(
          "The test ended without a final result. Check the Edge Function logs.",
        );
      }

      setTestLogId(result.logId);
      setTestMessage(result.message);
      setTestStatus(result.passed ? "passed" : "failed");

      await loadTestLogs();

      if (!result.passed) {
        // Leave the modal open so the user can inspect the failure.
        return;
      }

      /*
       * A manual test does not change the account's enabled
       * state. Only the switch-triggered test enables it.
       */
      if (enableAfterSuccess) {
        setSaving(true);

        const { data, error } = await callOrgRpc<unknown>("save_storage_account", {
          p_id: item.id,
            p_organization_id: organizationId,
          p_name: item.name,
          p_provider: item.provider,
          p_environment: item.environment,
          p_enabled: true,
          p_description: item.description,
          p_settings: connectionSettings(item.provider, item.settings),
          p_credentials: {},
        }, integrated);

        if (error) {
          throw new Error(
            "The storage test passed, but the account could not be enabled: " +
              error.message,
          );
        }

        const updated = parseStorageAccount(data);

        setAccounts((current) =>
          current.map((account) =>
            account.id === updated.id ? updated : account,
          ),
        );
      }

      setTestStatus("passed");

      setTestMessage(
        enableAfterSuccess
          ? "All tests passed and the report was saved. The storage account is now enabled."
          : "All tests passed and the report was saved. The storage account status was not changed.",
      );

      // Close the modal automatically after successful completion.
    } catch (error) {
      setTestStatus("failed");

      setTestMessage(
        error instanceof Error
          ? error.message
          : "The connectivity test failed.",
      );
    } finally {
      setTestRunning(false);
      setSaving(false);
    }
  }

  /*
   * Enabling runs the test first. Disabling is a normal status
   * change and does not need a connectivity test.
   */
  async function toggleAccount(item: StorageAccount) {
    if (saving || testRunning) return;

    if (!item.enabled) {
      await runStorageTest(item, true);
      return;
    }

    setSaving(true);
    setSectionError("");

    try {
      const { data, error } = await callOrgRpc<unknown>("save_storage_account", {
        p_id: item.id,
        p_organization_id: organizationId,
        p_name: item.name,
        p_provider: item.provider,
        p_environment: item.environment,
        p_enabled: false,
        p_description: item.description,
        p_settings: connectionSettings(item.provider, item.settings),
        p_credentials: {},
      }, integrated);

      if (error) throw new Error(error.message);

      const updated = parseStorageAccount(data);

      setAccounts((current) =>
        current.map((account) =>
          account.id === updated.id ? updated : account,
        ),
      );
    } catch (error) {
      setSectionError(
        error instanceof Error
          ? error.message
          : "Unable to disable the storage account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(item: StorageAccount) {
    if (saving || testRunning) return;

    if (
      !window.confirm(
        `Remove "${item.name}" and its stored provider credentials?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setSectionError("");

    try {
      const { data, error } = await callOrgRpc<boolean>(
        "delete_storage_account",
        { p_id: item.id, p_organization_id: organizationId },
        integrated,
      );

      if (error) throw new Error(error.message);

      if (data !== true) {
        throw new Error(
          "The storage account was not found or was already removed.",
        );
      }

      setAccounts((current) =>
        current.filter((account) => account.id !== item.id),
      );

      setLatestTests((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      if (editingId === item.id) closeForm();

      if (testingAccount?.id === item.id) {
        setTestModalOpen(false);
      }
    } catch (error) {
      setSectionError(
        error instanceof Error
          ? error.message
          : "Unable to remove the storage account.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: FieldSpec) {
    if (
      field.showWhen &&
      settingText(form.settings, field.showWhen.key) !== field.showWhen.value
    ) {
      return null;
    }

    const isCredential = field.source === "credentials";

    const value = isCredential
      ? form.credentials[field.key] || ""
      : settingText(form.settings, field.key);

    const savedCredential =
      isCredential &&
      Boolean(
        editingId &&
        accounts
          .find((item) => item.id === editingId)
          ?.credential_keys.includes(field.key),
      );

    const required = Boolean(
      field.required && (!isCredential || !savedCredential),
    );

    const className = `tooling-field${field.fullWidth ? " tooling-field-full" : ""}`;

    const common = {
      value,
      placeholder: field.placeholder || "",
      required,
      onChange: (
        event: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => {
        if (isCredential) {
          updateCredential(field.key, event.target.value);
        } else {
          updateSetting(field.key, event.target.value);
        }
      },
    };

    return (
      <label className={className} key={`${field.source}-${field.key}`}>
        <span>
          {field.label}
          {required ? " *" : ""}
        </span>

        {field.kind === "select" ? (
          <select {...common} className="auth-input">
            {(field.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.kind === "textarea" ? (
          <textarea
            {...common}
            className="tooling-textarea"
            rows={
              field.key === "gcsServiceAccountJson" ||
              field.key === "ociPrivateKeyPem"
                ? 6
                : 3
            }
            autoComplete="new-password"
          />
        ) : (
          <input
            {...common}
            className="auth-input"
            type={
              field.kind === "password"
                ? "password"
                : field.kind === "url"
                  ? "url"
                  : "text"
            }
            autoComplete={isCredential ? "new-password" : "off"}
            spellCheck={false}
          />
        )}

        {field.help && (
          <small className="storage-field-help">{field.help}</small>
        )}

        {savedCredential && (
          <small className="storage-field-help">
            A value is already stored securely. Leave this blank to keep it, or
            enter a replacement.
          </small>
        )}
      </label>
    );
  }

  return (
    <section className="panel tooling-panel">
      <div className="tooling-section-heading">
        <div>
          <h2 className="section-title">Storage accounts</h2>

          <p className="section-description">
            Connect to existing buckets and containers for exported files and
            backups. These settings are shared with users assigned to the
            selected Genesys Cloud organization.
          </p>
        </div>

        <button
          type="button"
          className="tooling-primary-button"
          onClick={() => (formOpen ? closeForm() : openNewForm())}
          disabled={saving || testRunning}
        >
          {formOpen ? "Close form" : "+ Add storage account"}
        </button>
      </div>

      <div className="tooling-notice">
        This form connects to existing buckets and containers only; it never
        creates them. Credentials are stored in Supabase Vault and never
        returned to the browser. Grant only the permissions required to list,
        read, create/write and delete objects. New accounts start disabled and
        must pass a connectivity test before they can be enabled.
      </div>

      {!hasSession && (
        <AlertBlock alertType="critical" title="Sign in required">
          Sign in to your Export Manager account to load and save storage
          accounts.
        </AlertBlock>
      )}

      {sectionError && (
        <AlertBlock alertType="critical" title="Storage accounts">
          {sectionError}
        </AlertBlock>
      )}

      {formError && (
        <AlertBlock alertType="critical" title="Check the storage account form">
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
              <span>Configuration name *</span>

              <input
                className="auth-input"
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Production export backups"
                maxLength={100}
                required
              />
            </label>

            <label className="tooling-field tooling-field-full">
              <span>Storage provider</span>

              <select
                className="auth-input"
                value={form.provider}
                disabled={Boolean(editingId)}
                onChange={(event) =>
                  changeProvider(event.target.value as StorageProvider)
                }
              >
                <option value="cloudflare-r2">Cloudflare R2</option>
                <option value="google-cloud-storage">
                  Google Cloud Storage
                </option>
                <option value="azure-blob">Microsoft Azure Blob Storage</option>
                <option value="aws-s3">Amazon S3</option>
                <option value="oracle-object-storage">
                  Oracle Cloud Infrastructure Object Storage
                </option>
              </select>

              {editingId && (
                <small className="storage-field-help">
                  Provider type is fixed after creation. Add another account to
                  configure a different provider.
                </small>
              )}
            </label>

            {fields.map((field) => renderField(field))}
          </div>

          <p className="storage-runtime-note">
            Ensure the credential has object read, create/write, delete and
            (where needed) list permissions for this existing destination.
            Permissions are granted in the provider console, not here.
          </p>

          <div className="tooling-form-actions">
            <button
              type="button"
              className="tooling-secondary-button"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="tooling-primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add storage account"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tooling-empty-state">
          <p>Loading storage accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="tooling-empty-state">
          <div className="tooling-empty-icon">
            <GenesysDevIcon icon={GenesysDevIcons.AppDataSource} />
          </div>

          <h3>No storage accounts configured</h3>

          <p>
            Connect an existing bucket or container to define a destination for
            future exports and backups.
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
          {accounts.map((item) => {
            const currentCredentialKeys = requiredCredentialKeys(item.provider);

            const hasRequiredCredentials = currentCredentialKeys.every((key) =>
              item.credential_keys.includes(key),
            );

            const latestTest = latestTests[item.id];

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

                      <span
                        className={`status-pill ${
                          item.enabled ? "status-completed" : "status-planned"
                        }`}
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <span className="tooling-config-environment">
                      {PROVIDER_LABELS[item.provider]}
                    </span>

                    <p>
                      Destination: {targetSummary(item) || "Not configured"}
                    </p>

                    <p>
                      Credentials:{" "}
                      {hasRequiredCredentials
                        ? "Credentials stored securely"
                        : "Required credentials incomplete"}
                    </p>

                    {latestTest && (
                      <p className="storage-last-test">
                        Last test:{" "}
                        <span
                          className={
                            latestTest.status === "passed"
                              ? "storage-test-status-passed"
                              : "storage-test-status-failed"
                          }
                        >
                          {latestTest.status === "passed" ? "Passed" : "Failed"}
                        </span>
                        {" · "}
                        {new Date(latestTest.finished_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="storage-card-actions-wrapper">
                  <div className="tooling-card-actions">
                    {/* Enabled / Disabled switch */}
                    <label className="settings-switch">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => void toggleAccount(item)}
                        disabled={saving || testRunning}
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

                    {/* Edit */}
                    <button
                      type="button"
                      className="tooling-secondary-button"
                      onClick={() => openEditForm(item)}
                      disabled={saving || testRunning}
                    >
                      Edit
                    </button>

                    {/* Test */}
                    <button
                      type="button"
                      className={`tooling-secondary-button storage-test-button ${
                        item.enabled ? "enabled" : "disabled"
                      }`}
                      onClick={() => void runStorageTest(item, false)}
                      disabled={!item.enabled || saving || testRunning}
                      title={
                        item.enabled
                          ? "Run a storage connectivity test"
                          : "Enable the account after a successful connectivity test"
                      }
                    >
                      Test
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      className="tooling-danger-button"
                      onClick={() => void removeAccount(item)}
                      disabled={saving || testRunning}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Download link on its own line, beneath Remove */}
                  {latestTest && (
                    <div className="storage-test-download-row">
                      <button
                        type="button"
                        className="storage-test-download-link"
                        onClick={() => void downloadTestReport(latestTest.id)}
                        disabled={saving || testRunning}
                      >
                        Download test result
                      </button>
                    </div>
                  )}
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
            Account configuration and connectivity tests are available.
            Automated export and backup uploads remain part of the storage
            execution backend.
          </p>
        </div>

        <span className="placeholder-label">
          Upload execution in development
        </span>
      </div>

      <div className="resource-placeholder-grid">
        {[
          {
            title: "Google Cloud Storage",
            logoUrl: PROVIDER_LOGOS["google-cloud-storage"],
            description: "Connect to existing Cloud Storage buckets.",
          },
          {
            title: "Microsoft Azure",
            logoUrl: PROVIDER_LOGOS["azure-blob"],
            description: "Connect to existing Blob Storage containers.",
          },
          {
            title: "Amazon S3",
            logoUrl: PROVIDER_LOGOS["aws-s3"],
            description: "Connect to existing S3 buckets.",
          },
          {
            title: "Oracle Cloud Infrastructure",
            logoUrl: PROVIDER_LOGOS["oracle-object-storage"],
            description: "Connect to existing OCI Object Storage buckets.",
          },
        ].map((provider) => (
          <article className="resource-placeholder-card" key={provider.title}>
            <div className="resource-placeholder-icon">
              <img
                src={provider.logoUrl}
                alt=""
                aria-hidden="true"
                width={32}
                height={28}
                loading="lazy"
                style={{ objectFit: "contain" }}
              />
            </div>

            <span className="placeholder-label">Connection test available</span>

            <h3>{provider.title}</h3>
            <p>{provider.description}</p>

            <span className="resource-placeholder-footer">
              Export upload execution in development
            </span>
          </article>
        ))}
      </div>

      {/* Storage connectivity test modal */}
      {testModalOpen && testingAccount && (
        <div className="storage-test-backdrop">
          <section
            className="storage-test-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="storage-test-title"
            aria-describedby="storage-test-description"
          >
            <div className="storage-test-heading">
              <div>
                <h2 id="storage-test-title">Storage connectivity test</h2>

                <p>
                  {testingAccount.name}
                  {" — "}
                  {PROVIDER_LABELS[testingAccount.provider]}
                </p>
              </div>

              <span
                className={`storage-test-badge ${
                  testStatus === "running"
                    ? "running"
                    : testStatus === "failed"
                      ? "failed"
                      : testStatus === "passed"
                        ? "passed"
                        : ""
                }`}
              >
                {testStatus === "running"
                  ? "Testing"
                  : testStatus === "passed"
                    ? "Passed"
                    : testStatus === "failed"
                      ? "Failed"
                      : "Ready"}
              </span>
            </div>

            <p
              id="storage-test-description"
              className="storage-test-description"
            >
              The application will connect to the existing destination and
              verify upload, file modification and deletion permissions using a
              temporary file containing dummy text only. No bucket or container
              will be created.
            </p>

            <div className="storage-test-steps">
              {testSteps.map((step) => (
                <div
                  className={`storage-test-step ${step.status}`}
                  key={step.key}
                >
                  <span
                    className={`storage-test-step-icon ${step.status}`}
                    aria-hidden="true"
                  >
                    {step.status === "passed"
                      ? "✓"
                      : step.status === "failed"
                        ? "!"
                        : step.status === "running"
                          ? "…"
                          : "○"}
                  </span>

                  <div className="storage-test-step-copy">
                    <strong>{step.label}</strong>

                    <span>{step.message}</span>

                    {step.durationMs !== undefined && (
                      <small>{step.durationMs} ms</small>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {testMessage && (
              <div
                className={`storage-test-message ${
                  testStatus === "failed" ? "failed" : ""
                }`}
                role="status"
                aria-live="polite"
              >
                {testMessage}
              </div>
            )}

            <div className="storage-test-actions">
              {testLogId && (
                <button
                  type="button"
                  className="tooling-secondary-button"
                  onClick={() => void downloadTestReport(testLogId)}
                >
                  Download test result
                </button>
              )}

              {!testRunning && (
                <>
                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={() =>
                      void runStorageTest(testingAccount, testWillEnable)
                    }
                  >
                    Run test again
                  </button>

                  <button
                    type="button"
                    className="tooling-primary-button"
                    onClick={() => setTestModalOpen(false)}
                  >
                    Close
                  </button>
                </>
              )}
            </div>

            {testRunning && (
              <p className="storage-test-footer">
                Please keep this window open until the test completes.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
