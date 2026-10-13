import ToolingConfigurationsSection from "../components/settings/ToolingConfigurationsSection";
import StorageAccountsSection from "../components/settings/StorageAccountsSection";

export default function SettingsPage() {
  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-description">
            Manage organization-shared tooling configurations and cloud storage
            accounts.
          </p>
        </div>
      </div>

      <ToolingConfigurationsSection />
      <StorageAccountsSection />
    </div>
  );
}
