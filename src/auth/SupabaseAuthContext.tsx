import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "../lib/supabaseClient";
import {
  SupabaseAuthContext,
  type OrganizationAccess,
  type UserProfile,
} from "./supabase-auth-context";

import type { User } from "@supabase/supabase-js";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return String(error);

  const details = error as Record<string, unknown>;
  const message =
    typeof details.message === "string" ? details.message : "";
  const code = typeof details.code === "string" ? details.code : "";
  const detail =
    typeof details.details === "string" ? details.details : "";
  const hint = typeof details.hint === "string" ? details.hint : "";
  const description = [message, detail && `Details: ${detail}`, hint && `Hint: ${hint}`]
    .filter(Boolean)
    .join(" ");

  if (description) return code ? `${description} (${code})` : description;
  return JSON.stringify(error);
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const nextUser = session?.user ?? null;

      setUser(nextUser);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setProfileError(error.message);
      }

      const nextUser = data.session?.user ?? null;

      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id ?? null;

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_access");

    if (error) throw error;
    if (data === null) return { profile: null, organizations: [] };
    if (typeof data !== "object" || !("profile" in data) || !("organizations" in data)) {
      throw new Error("Supabase returned an invalid access profile.");
    }
    const access = data as {
      profile: UserProfile | null;
      organizations: OrganizationAccess[];
    };
    if (
      !access.profile ||
      !Array.isArray(access.organizations) ||
      !access.organizations.every(
        (organization) =>
          typeof organization.id === "string" &&
          typeof organization.name === "string",
      )
    ) {
      throw new Error("Supabase returned incomplete access details.");
    }
    return access;
  }, []);

  const selectActiveOrganization = useCallback((available: OrganizationAccess[]) => {
    const savedId = localStorage.getItem("export-manager-active-organization");
    const selected = available.some((organization) => organization.id === savedId)
      ? savedId
      : available[0]?.id ?? null;
    setActiveOrganizationIdState(selected);
    if (selected) localStorage.setItem("export-manager-active-organization", selected);
    else localStorage.removeItem("export-manager-active-organization");
  }, []);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    if (!organizations.some((organization) => organization.id === organizationId)) {
      throw new Error("You do not have access to that organization.");
    }
    setActiveOrganizationIdState(organizationId);
    localStorage.setItem("export-manager-active-organization", organizationId);
  }, [organizations]);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setProfile(null);
      setOrganizations([]);
      setActiveOrganizationIdState(null);
      setProfileError("");
      setProfileLoading(false);

      return () => {
        active = false;
      };
    }

    setProfileLoading(true);
    setProfileError("");

    void loadProfile()
      .then((access) => {
        if (active) {
          setProfile(access.profile);
          setOrganizations(access.organizations);
          selectActiveOrganization(access.organizations);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProfile(null);
          setProfileError(errorMessage(error));
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, loadProfile, selectActiveOrganization]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;

    setProfileLoading(true);
    setProfileError("");

    try {
      const access = await loadProfile();
      setProfile(access.profile);
      setOrganizations(access.organizations);
      selectActiveOrganization(access.organizations);
    } catch (error) {
      setProfileError(errorMessage(error));
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [userId, loadProfile, selectActiveOrganization]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setUser(null);
    setProfile(null);
    setOrganizations([]);
    setActiveOrganizationIdState(null);
    setProfileError("");
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        profile,
        organizations,
        activeOrganizationId,
        setActiveOrganizationId,
        loading,
        profileLoading,
        profileError,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}
