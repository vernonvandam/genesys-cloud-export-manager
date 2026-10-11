import ToolingConfigurationsSection from "../components/settings/ToolingConfigurationsSection";
import StorageAccountsSection from "../components/settings/StorageAccountsSection";
import GenesysAuthenticationSection from "../components/settings/GenesysAuthenticationSection";
import LocalAccountSection from "../components/settings/LocalAccountSection";

export default function SettingsPage() {
  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-description">
            Manage tooling configurations, cloud storage accounts, Genesys authentication and your Export Manager account.
          </p>
        </div>
      </div>

      <ToolingConfigurationsSection />
      <StorageAccountsSection />
      <GenesysAuthenticationSection />
      <LocalAccountSection />
    </div>
  );
}
