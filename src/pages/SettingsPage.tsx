import { AlertBlock } from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'
import ConfigRow from '../components/common/ConfigRow'

export default function SettingsPage() {
  const { config, user } = useAuth()

  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-description">
            Review the runtime configuration supplied
            when this application was launched.
          </p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div className="settings-title-icon">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppShieldCheck}
            />
          </div>

          <div>
            <h2 className="section-title">
              Genesys Cloud connection
            </h2>
            <p className="section-description">
              Current user session and non-secret
              launch configuration.
            </p>
          </div>

          <span className="status-pill status-completed">
            Connected
          </span>
        </div>

        <div className="settings-config-list">
          <ConfigRow
            label="Client ID"
            value={
              config.clientId
                ? 'Configured (hidden)'
                : 'Missing'
            }
          />

          <ConfigRow
            label="Region"
            value={config.region}
          />

          <ConfigRow
            label="Redirect URI"
            value={config.redirectUri}
          />

          <ConfigRow
            label="Authentication"
            value="OAuth Authorization Code with PKCE"
          />

          <ConfigRow
            label="Signed-in user"
            value={
              user?.email ||
              user?.name ||
              'Not provided'
            }
          />
        </div>

        <AlertBlock
          alertType="info"
          title="Customer-specific configuration"
        >
          Client ID, region and redirect URI are supplied
          at runtime. This browser application does not
          require a client secret.
        </AlertBlock>
      </section>
    </div>
  )
}