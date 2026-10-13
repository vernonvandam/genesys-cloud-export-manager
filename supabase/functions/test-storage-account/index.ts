import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyGenesysAccessToken } from "../_shared/genesys.ts";
import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, } from "npm:@aws-sdk/client-s3@3.883.0";
import { Storage } from "npm:@google-cloud/storage@7.16.0";
import { ContainerClient, } from "npm:@azure/storage-blob@12.27.0";
import * as objectstorage from "npm:oci-objectstorage@2.142.2";
import * as common from "npm:oci-common@2.142.2";
import { Buffer } from "node:buffer";
import { FetchHttpHandler, } from "npm:@smithy/fetch-http-handler@5.1.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-cache, no-transform", };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY")!;
type Provider = "cloudflare-r2" | "google-cloud-storage" | "azure-blob" | "aws-s3" | "oracle-object-storage";
type TestStageKey = "connect" | "upload" | "edit" | "delete";
type StageResult = {
  key: TestStageKey;
  label: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
  durationMs?: number;
};
type ConnectionConfig = {
  id: string;
  organization_id: string;
  name: string;
  provider: Provider;
  settings: Record<string, unknown>;
  credentials: Record<string, string>;
};
type StorageDriver = {
  connect: (key: string) => Promise<void>;
  write: (key: string, contents: string) => Promise<void>;
  read: (key: string) => Promise<string>;
  remove: (key: string) => Promise<void>;
  exists: (key: string) => Promise<boolean>;
};
const STAGES: Array<{
  key: TestStageKey;
  label: string;
}> = [{ key: "connect", label: "Connect to storage" }, { key: "upload", label: "Upload and read dummy file" }, { key: "edit", label: "Edit and verify dummy file" }, { key: "delete", label: "Delete and verify removal" },];
function required(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required connection field: ${key}`);
  }
  return value.trim();
}
function getStatusCode(error: unknown): number | undefined {
  const e = error as Record<string, unknown>;
  const metadata = e?.$metadata as Record<string, unknown> | undefined;
  const value = metadata?.httpStatusCode ?? e?.statusCode ?? e?.status;
  return typeof value === "number" ? value : undefined;
}

/*
 * Never persist raw provider errors: they may contain request URLs,
 * signatures, SAS query strings or other sensitive information.
 */
function safeErrorMessage(error: unknown): string {
  const e = error as Record<string, unknown>;
  const status = getStatusCode(error);
  const code = String(e?.name ?? e?.code ?? e?.Code ?? "");
  if (status === 401 || status === 403 || /AccessDenied|Forbidden|Unauthorized|InvalidSignature|InvalidAccessKey/i.test(code)) {
    return "Authentication failed or the credential lacks the required permissions.";
  }
  if (status === 404 || /NotFound|NoSuchBucket|NoSuchContainer|NoSuchKey/i.test(code)) {
    return "The configured bucket, container or test object could not be found.";
  }
  if (/Timeout|Networking|ECONN|ENOTFOUND/i.test(code)) {
    return "The provider request timed out or could not reach the storage endpoint.";
  }
  return "The provider operation failed. Check the destination, region, credentials and required permissions.";
}
function toPlainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The storage account configuration is invalid.");
  }
  return value as Record<string, unknown>;
}
function parseConfig(value: unknown): ConnectionConfig {
  const config = toPlainObject(value);
  const id = required(config, "id");
  const organization_id = required(config, "organization_id");
  const name = required(config, "name");
  const provider = required(config, "provider") as Provider;
  const validProviders: Provider[] = ["cloudflare-r2", "google-cloud-storage", "azure-blob", "aws-s3", "oracle-object-storage",];
  if (!validProviders.includes(provider)) {
    throw new Error("Unsupported storage provider.");
  }
  return { id, organization_id, name, provider, settings: toPlainObject(config.settings), credentials: Object.fromEntries(Object.entries(toPlainObject(config.credentials)).map(([key, value]) => [key, String(value)])), };
}
async function bodyToText(value: unknown): Promise<string> {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (value instanceof ReadableStream) {
    return await new Response(value).text();
  }
  const stream = value as {
    transformToString?: () => Promise<string>;
    [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
  } | null;
  if (stream?.transformToString) {
    return await stream.transformToString();
  }
  if (stream?.[Symbol.asyncIterator]) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<unknown>) {
      chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk instanceof Uint8Array ? chunk : new Uint8Array());
    }
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(combined);
  }
  throw new Error("The downloaded object could not be read.");
}
function createDriver(config: ConnectionConfig): StorageDriver {
  const settings = config.settings;
  const credentials = config.credentials;
  switch (config.provider) {
    case "cloudflare-r2":
    case "aws-s3": {
      const isR2 = config.provider === "cloudflare-r2";
      const client = new S3Client({ region: isR2 ? "auto" : required(settings, "region"), requestHandler: new FetchHttpHandler({ requestTimeout: 30000, }), ...(isR2 ? { endpoint: `https://${required(settings, "accountId")}.r2.cloudflarestorage.com`, forcePathStyle: true, } : {}), credentials: { accessKeyId: required(credentials, isR2 ? "r2AccessKeyId" : "awsAccessKeyId"), secretAccessKey: required(credentials, isR2 ? "r2SecretAccessKey" : "awsSecretAccessKey"), ...(credentials.awsSessionToken ? { sessionToken: credentials.awsSessionToken } : {}), }, });
      const bucket = required(settings, "bucketName");
      return {
        async connect() {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        }, async write(key, contents) {
          await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: contents, ContentType: "text/plain; charset=utf-8", }));
        }, async read(key) {
          const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, }));
          if (!response.Body) {
            throw new Error("The uploaded object returned an empty body.");
          }
          return await response.Body.transformToString();
        }, async remove(key) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, }));
        }, async exists(key) {
          try {
            await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key, }));
            return true;
          }
          catch (error) {
            if (getStatusCode(error) === 404 || (error as {
              name?: string;
            })?.name === "NotFound") {
              return false;
            }
            throw error;
          }
        },
      };
    }
    case "google-cloud-storage": {
      const bucketName = required(settings, "bucketName");
      const keyJson = JSON.parse(required(credentials, "gcsServiceAccountJson"));
      const storage = new Storage({ projectId: keyJson.project_id, credentials: { client_email: keyJson.client_email, private_key: String(keyJson.private_key).replace(/\\n/g, "\n"), }, });
      const bucket = storage.bucket(bucketName);
      return {
        async connect(key) {
          await bucket.getFiles({ prefix: key, maxResults: 1, });
        }, async write(key, contents) {
          await bucket.file(key).save(contents, { resumable: false, metadata: { contentType: "text/plain; charset=utf-8", }, });
        }, async read(key) {
          const [contents] = await bucket.file(key).download();
          return contents.toString("utf8");
        }, async remove(key) {
          await bucket.file(key).delete({ ignoreNotFound: true, });
        }, async exists(key) {
          const [exists] = await bucket.file(key).exists();
          return exists;
        },
      };
    }
    case "azure-blob": {
      const accountName = required(settings, "storageAccountName");
      const containerName = required(settings, "containerName");
      const sasToken = required(credentials, "azureSasToken").replace(/^\?/, "");
      const container = new ContainerClient(`https://${accountName}.blob.core.windows.net/${containerName}?${sasToken}`);
      const getBlob = (key: string) => container.getBlockBlobClient(key);
      return {
        async connect(key) {
          const pages = container.listBlobsFlat({ prefix: key }).byPage({ maxPageSize: 1 });
          await pages.next();
        }, async write(key, contents) {
          await getBlob(key).uploadData(new TextEncoder().encode(contents), { blobHTTPHeaders: { blobContentType: "text/plain; charset=utf-8", }, });
        }, async read(key) {
          const response = await getBlob(key).download();
          return await bodyToText(response.readableStreamBody ?? response.blobBody);
        }, async remove(key) {
          await getBlob(key).deleteIfExists();
        }, async exists(key) {
          return await getBlob(key).exists();
        },
      };
    }
    case "oracle-object-storage": {
      const region = common.Region.fromRegionId(required(settings, "region"));
      const provider = new common.SimpleAuthenticationDetailsProvider(required(settings, "tenancyOcid"), required(settings, "userOcid"), required(settings, "fingerprint"), required(credentials, "ociPrivateKeyPem"), credentials.ociPrivateKeyPassphrase || null, region);
      const client = new objectstorage.ObjectStorageClient({ authenticationDetailsProvider: provider, });
      const namespaceName = required(settings, "namespaceName");
      const bucketName = required(settings, "bucketName");
      return {
        async connect(key) {
          await client.listObjects({ namespaceName, bucketName, prefix: key, limit: 1, });
        }, async write(key, contents) {
          const bytes = Buffer.from(contents, "utf8");
          await client.putObject({ namespaceName, bucketName, objectName: key, putObjectBody: bytes, contentLength: bytes.length, contentType: "text/plain; charset=utf-8", });
        }, async read(key) {
          const response = await client.getObject({ namespaceName, bucketName, objectName: key, });
          return await bodyToText(response.value);
        }, async remove(key) {
          await client.deleteObject({ namespaceName, bucketName, objectName: key, });
        }, async exists(key) {
          const response = await client.listObjects({ namespaceName, bucketName, prefix: key, limit: 1, });
          const objects = response.objects ?? response.listObjects?.objects ?? [];
          return objects.some((object: {
            name?: string;
          }) => object.name === key);
        },
      };
    }
  }
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
  }
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return Response.json({ error: "Authentication required." }, { status: 401, headers: corsHeaders });
    }

    let requestBody: Record<string, unknown>;
    try {
      requestBody = toPlainObject(await request.json());
    } catch {
      return Response.json({ error: "A valid JSON request body is required." }, { status: 400, headers: corsHeaders });
    }

    const storageAccountId = requestBody.storageAccountId;
    if (typeof storageAccountId !== "string" || !storageAccountId.trim()) {
      return Response.json({ error: "A storage account ID is required." }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, }, });
    let organizationId: string;
    let userId: string | null = null;

    if (requestBody.region !== undefined) {
      if (typeof requestBody.region !== "string") {
        return Response.json({ error: "A Genesys Cloud region is required." }, { status: 400, headers: corsHeaders });
      }
      let identity: Awaited<ReturnType<typeof verifyGenesysAccessToken>>;
      try {
        identity = await verifyGenesysAccessToken(authorization.slice(7), requestBody.region);
      } catch {
        return Response.json({ error: "Your Genesys Cloud session could not be verified." }, { status: 401, headers: corsHeaders });
      }

      const { data: storedIdentity, error: identityError } = await admin
        .from("integrated_users")
        .select("id")
        .eq("organization_id", identity.organizationId)
        .eq("genesys_user_id", identity.userId)
        .maybeSingle();
      if (identityError) {
        console.error("Storage test Genesys identity lookup failed", identityError);
        return Response.json({ error: "Unable to verify your Genesys Cloud access." }, { status: 500, headers: corsHeaders });
      }
      if (!storedIdentity) {
        return Response.json({ error: "Complete Genesys sign-in before testing storage." }, { status: 403, headers: corsHeaders });
      }
      organizationId = identity.organizationId;
    } else {
      const requestedOrganizationId = requestBody.organizationId;
      if (typeof requestedOrganizationId !== "string" || !requestedOrganizationId.trim()) {
        return Response.json({ error: "An organization ID is required." }, { status: 400, headers: corsHeaders });
      }

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(authorization.slice(7));
      if (authError || !authData.user) {
        return Response.json({ error: "Your session is invalid or has expired." }, { status: 401, headers: corsHeaders });
      }
      const { data: hasAccess, error: accessError } = await userClient.rpc("has_organization_access", {
        p_organization_id: requestedOrganizationId.trim(),
      });
      if (accessError) {
        console.error("Storage test organization access check failed", accessError);
        return Response.json({ error: "Unable to verify organization access." }, { status: 500, headers: corsHeaders });
      }
      if (hasAccess !== true) {
        return Response.json({ error: "You do not have access to this organization." }, { status: 403, headers: corsHeaders });
      }
      organizationId = requestedOrganizationId.trim();
      userId = authData.user.id;
    }

    const { data: rawConfig, error: configError } = await admin.rpc("get_storage_account_test_config", {
      p_id: storageAccountId.trim(),
      p_organization_id: organizationId,
    });
    if (configError) {
      console.error("Storage test configuration lookup failed", {
        accountId: storageAccountId,
        organizationId,
        code: configError.code,
      });
      return Response.json({ error: "Unable to load the saved storage account configuration." }, { status: 500, headers: corsHeaders });
    }
    if (!rawConfig) {
      return Response.json({ error: "Storage account not found." }, { status: 404, headers: corsHeaders });
    }
    const config = parseConfig(rawConfig);
    if (config.id !== storageAccountId.trim() || config.organization_id !== organizationId) {
      return Response.json({ error: "Storage account not found." }, { status: 404, headers: corsHeaders });
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let streamClosed = false;
        const emit = (payload: unknown) => {
          if (streamClosed)
            return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
          catch {
            streamClosed = true;
          }
        };
        controller.enqueue(encoder.encode(": connectivity test started\n\n"));
        void (async () => {
          const testId = crypto.randomUUID();
          const startedAt = new Date().toISOString();
          const objectKey = `.genesys-export-manager-tests/${userId ?? "integrated"}/${config.id}/${testId}.txt`;
          const originalText = ["THIS IS A DUMMY CONNECTIVITY TEST FILE.", "NO CUSTOMER DATA IS PRESENT.", "USED ONLY TO VERIFY STORAGE ACCESS.", "",].join("\n");
          const editedText = ["THIS IS A DUMMY CONNECTIVITY TEST FILE.", "NO CUSTOMER DATA IS PRESENT.", "EDIT VERIFICATION PASSED.", "",].join("\n");
          const stageResults: Record<TestStageKey, StageResult> = Object.fromEntries(STAGES.map((stage) => [stage.key, { ...stage, status: "pending", message: "Waiting to start.", },])) as Record<TestStageKey, StageResult>;
          let driver: StorageDriver | null = null;
          let objectMayExist = false;
          let testError: string | null = null;
          let cleanup: {
            status: "not-required" | "passed" | "failed";
            message: string;
          } = { status: "not-required", message: "No cleanup was required.", };
          async function runStage(key: TestStageKey, work: () => Promise<void>) {
            const result = stageResults[key];
            const started = Date.now();
            result.status = "running";
            result.message = "In progress.";
            emit({ type: "stage", key, status: "running", message: result.message, });
            try {
              await work();
              result.status = "passed";
              result.message = "Completed successfully.";
              result.durationMs = Date.now() - started;
              emit({ type: "stage", key, status: "passed", message: result.message, durationMs: result.durationMs, });
            }
            catch (error) {
              result.status = "failed";
              result.message = safeErrorMessage(error);
              result.durationMs = Date.now() - started;
              emit({ type: "stage", key, status: "failed", message: result.message, durationMs: result.durationMs, });
              throw error;
            }
          }
          try {
            await runStage("connect", async () => {
              driver = createDriver(config);
              await driver.connect(objectKey);
            });
            await runStage("upload", async () => {
              if (!driver)
                throw new Error("Driver unavailable.");
                            /*
                             * Set this before uploading because a network timeout
                             * can happen after the provider has stored the object.
                             */
                            objectMayExist = true;
              await driver.write(objectKey, originalText);
              const readBack = await driver.read(objectKey);
              if (readBack !== originalText) {
                throw new Error("The uploaded file did not match the expected dummy text.");
              }
            });
            await runStage("edit", async () => {
              if (!driver)
                throw new Error("Driver unavailable.");
              await driver.write(objectKey, editedText);
              const readBack = await driver.read(objectKey);
              if (readBack !== editedText) {
                throw new Error("The edited file did not match the expected dummy text.");
              }
            });
            await runStage("delete", async () => {
              if (!driver)
                throw new Error("Driver unavailable.");
              await driver.remove(objectKey);
              const remains = await driver.exists(objectKey);
              if (remains) {
                throw new Error("The dummy file still exists after the delete operation.");
              }
              objectMayExist = false;
            });
          }
          catch (error) {
            testError = safeErrorMessage(error);
          }

          /*
           * If an earlier operation failed, attempt to remove the
           * unique dummy file before finishing the test.
           */
          if (objectMayExist && driver) {
            try {
              await driver.remove(objectKey);
              const remains = await driver.exists(objectKey);
              if (remains) {
                throw new Error("The dummy object still exists.");
              }
              cleanup = { status: "passed", message: "The temporary dummy file was removed.", };
            }
            catch (error) {
              cleanup = { status: "failed", message: safeErrorMessage(error), };
            }
          }
          const finishedAt = new Date().toISOString();
          const operationsPassed = !testError && STAGES.every((stage) => stageResults[stage.key].status === "passed");
          const report = { version: 1, testId, storageAccountId: config.id, storageAccountName: config.name, provider: config.provider, status: operationsPassed ? "passed" : "failed", startedAt, finishedAt, testObjectKey: objectKey, dummyFileOnly: true, steps: STAGES.map((stage) => stageResults[stage.key]), cleanup, error: testError, };
          /*
           * A test is not considered successful until its report
           * has also been persisted.
           */
          const { data: logRow, error: logError } = await admin
            .from("storage_account_test_logs")
            .insert({
              organization_id: config.organization_id,
              user_id: userId,
              storage_account_id: config.id,
              storage_account_name: config.name,
              provider: config.provider,
              status: operationsPassed ? "passed" : "failed",
              started_at: startedAt,
              finished_at: finishedAt,
              report,
            })
            .select("id")
            .single();
          const reportSaved = !logError && Boolean(logRow?.id);
          const passed = operationsPassed && reportSaved;
          emit({ type: "complete", passed, status: passed ? "passed" : "failed", logId: reportSaved ? logRow.id : null, message: logError ? "The storage operations finished, but the test report could not be saved. The account remains disabled." : passed ? "All connectivity checks passed and the test report was saved." : cleanup.status === "failed" ? "The test failed and cleanup could not be verified. Check the destination for the temporary dummy file." : testError ?? "One or more connectivity checks failed.", });
        })().catch(() => {
          emit({ type: "complete", passed: false, status: "failed", logId: null, message: "The test could not be completed. The storage account remains disabled.", });
        }).finally(() => {
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.close();
            }
            catch {
              // The client may have disconnected.
            }
          }
        });
      }, cancel() {
        // The test must continue its cleanup/reporting even if the
        // browser closes its connection.
      },
    });
    return new Response(stream, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no", }, });
  }
  catch (error) {
    console.error("Storage connectivity test request failed", safeErrorMessage(error));
    return Response.json({ error: "The storage connectivity test could not be started.", }, { status: 500, headers: corsHeaders });
  }
});
