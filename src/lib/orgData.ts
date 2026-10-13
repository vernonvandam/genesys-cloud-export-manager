import { supabase } from "./supabaseClient";

type IntegratedCredentials = {
  accessToken: string;
  region: string;
};

type RpcResult<T> = {
  data: T | null;
  error: Error | null;
};

export async function callOrgRpc<T>(
  action: string,
  params: Record<string, unknown>,
  integrated?: IntegratedCredentials,
): Promise<RpcResult<T>> {
  if (!integrated) {
    const { data, error } = await supabase.rpc(action, params);
    return { data: data as T | null, error };
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/org-data`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${integrated.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        params,
        region: integrated.region,
      }),
    },
  );

  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : `Organization request failed (${response.status}).`;
    return { data: null, error: new Error(message) };
  }
  if (typeof result !== "object" || result === null || !("data" in result)) {
    return {
      data: null,
      error: new Error("The organization service returned an invalid response."),
    };
  }
  return { data: result.data as T, error: null };
}

export async function callOrgFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  integrated?: IntegratedCredentials,
): Promise<T> {
  if (!integrated) {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
    });
    if (error) throw new Error(error.message);
    if (data === null) throw new Error("The service returned no response.");
    return data;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${integrated.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, region: integrated.region }),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : `The service request failed (${response.status}).`;
    throw new Error(message);
  }
  return result as T;
}
