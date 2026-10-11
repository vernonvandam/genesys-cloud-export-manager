import { useState } from "react";

import { AlertBlock } from "genesys-react-components";
import { GenesysDevIcon, GenesysDevIcons } from "genesys-dev-icons";

import { useAuth } from "../../auth/useAuth";
import { useSupabaseAuth } from "../../auth/useSupabaseAuth";
import ConfigRow from "../common/ConfigRow";
import { supabase } from "../../lib/supabaseClient";

export default function LocalAccountSection() {
  const { disconnectGenesys } = useAuth();
  const { user: standaloneUser, profile: standaloneProfile, signOut } = useSupabaseAuth();

  const [signOutError, setSignOutError] = useState("");
  const [accountDeleteError, setAccountDeleteError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleSignOut() {
    setSignOutError("");
    try {
      disconnectGenesys();
      await signOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  async function handleDeleteAccount() {
    if (!standaloneUser?.id) return;

    const confirmation = window.prompt(
      "This permanently deletes your Export Manager account and associated database records. This action cannot be undone.\n\nType DELETE to confirm.",
    );
    if (confirmation === null) return;
    if (confirmation.trim() !== "DELETE") {
      setAccountDeleteError("Account deletion cancelled because the confirmation text did not match.");
      return;
    }

    setAccountDeleteError("");
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE" },
      });
      if (error) throw new Error(error.message);

      disconnectGenesys();
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace("/");
    } catch (error) {
      setAccountDeleteError(
        error instanceof Error ? error.message : "Unable to delete the account. Please try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  if (!standaloneUser) return null;

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div className="settings-title-icon"><GenesysDevIcon icon={GenesysDevIcons.AppUserSolid} /></div>
        <div>
          <h2 className="section-title">Local account</h2>
          <p className="section-description">Manage your Export Manager account and sign-in.</p>
        </div>
      </div>

      <div className="settings-config-list">
        <ConfigRow label="Email" value={standaloneUser.email || "Not available"} />
        <ConfigRow label="Name" value={standaloneProfile?.display_name || "Not set"} />
      </div>

      {signOutError && (
        <AlertBlock alertType="critical" title="Sign-out failed">{signOutError}</AlertBlock>
      )}
      {accountDeleteError && (
        <AlertBlock alertType="critical" title="Account deletion failed">{accountDeleteError}</AlertBlock>
      )}

      <div className="tooling-form-actions">
        <button type="button" className="tooling-secondary-button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </div>

      <div className="account-danger-zone">
        <div>
          <h3>Delete account</h3>
          <p>Permanently delete your Export Manager account and associated records. This cannot be undone.</p>
        </div>
        <button type="button" className="tooling-danger-button" onClick={() => void handleDeleteAccount()} disabled={deletingAccount}>
          {deletingAccount ? "Deleting account..." : "Delete account"}
        </button>
      </div>
    </section>
  );
}
