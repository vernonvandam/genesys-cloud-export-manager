import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useSupabaseAuth } from "../auth/useSupabaseAuth";
import AccessAdministrationSection from "../components/settings/AccessAdministrationSection";
import OrganizationAdministrationSection from "../components/settings/OrganizationAdministrationSection";

export default function AdminPage() {
  const { mode } = useAuth();
  const { profile } = useSupabaseAuth();

  if (mode !== "standalone" || profile?.role !== "global_admin") {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="workspace-view admin-page">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Administration</h2>
          <p className="page-description">
            Manage Genesys Cloud organizations, local users, and access
            requests.
          </p>
        </div>
      </div>

      <OrganizationAdministrationSection />
      <AccessAdministrationSection />
    </div>
  );
}
