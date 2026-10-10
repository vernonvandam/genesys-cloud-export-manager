import { useNavigate } from 'react-router-dom'
import {
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../auth/useAuth'
import DemoTag from '../components/common/DemoTag'
import ExportTable from '../components/common/ExportTable'

export default function OverviewPage() {
  const { config, user } = useAuth()
  const navigate = useNavigate()

  const firstName = user?.name
    ? user.name.split(/\s+/)[0]
    : undefined

  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">
            Your export workspace
          </h2>
          <p className="page-description">
            Review activity and manage your Genesys Cloud
            configuration.
          </p>
        </div>
        <DemoTag />
      </div>

      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-kicker">
            WELCOME BACK
          </span>

          <h2>
            {firstName
              ? `Hello, ${firstName}`
              : 'Welcome back'}
          </h2>

          <p>
            Your Genesys Cloud session is connected.
            Start a configuration export or review
            previous activity.
          </p>
        </div>

        <div className="welcome-action">
          <DxButton
            type="primary"
            onClick={() => navigate('/app/resources')}
          >
            <GenesysDevIcon
              icon={GenesysDevIcons.AppPlus}
            />
            Start a new export
          </DxButton>
        </div>

        <div
          className="welcome-decoration"
          aria-hidden="true"
        >
          <GenesysDevIcon
            icon={GenesysDevIcons.AppDataSource}
          />
        </div>
      </section>

      <section
        className="connection-summary"
        aria-label="Genesys Cloud connection"
      >
        <div className="connection-summary-icon">
          <GenesysDevIcon
            icon={GenesysDevIcons.AppShieldCheck}
          />
        </div>

        <div className="connection-summary-copy">
          <span className="connection-summary-title">
            Connected to Genesys Cloud
          </span>
          <span className="connection-summary-subtitle">
            Authenticated as{' '}
            {user?.email || user?.name || 'current user'}
          </span>
        </div>

        <span className="region-chip">
          {config.region}
        </span>
      </section>

      <section
        className="metric-grid"
        aria-label="Export statistics"
      >
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Export runs this month
            </span>
            <span className="metric-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppRefresh}
              />
            </span>
          </div>
          <span className="metric-value">12</span>
          <span className="metric-footnote">
            Illustrative sample value
          </span>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Completed
            </span>
            <span className="metric-icon metric-icon-success">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppCheckSolid}
              />
            </span>
          </div>
          <span className="metric-value">10</span>
          <span className="metric-footnote">
            Illustrative sample value
          </span>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Drafts / planned
            </span>
            <span className="metric-icon metric-icon-warning">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppDocumentEdit}
              />
            </span>
          </div>
          <span className="metric-value">2</span>
          <span className="metric-footnote">
            Illustrative sample value
          </span>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">
              Resource groups
            </span>
            <span className="metric-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppTreeView}
              />
            </span>
          </div>
          <span className="metric-value">4</span>
          <span className="metric-footnote">
            Available categories
          </span>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2 className="section-title">
              Export workflows
            </h2>
            <p className="section-description">
              Create a configuration backup or explore
              additional resource categories.
            </p>
          </div>

          <button
            type="button"
            className="text-action"
            onClick={() => navigate('/app/resources')}
          >
            View all resources
            <GenesysDevIcon
              icon={GenesysDevIcons.AppChevronRight}
            />
          </button>
        </div>

        <div className="workflow-grid">
          <article className="workflow-card workflow-card-primary">
            <div className="workflow-card-top">
              <div className="workflow-icon workflow-icon-primary">
                <GenesysDevIcon
                  icon={GenesysDevIcons.AppTreeView}
                />
              </div>
              <span className="primary-label">
                Primary workflow
              </span>
            </div>

            <h3>Configuration export &amp; backup</h3>

            <p>
              Collect supported configuration, prepare a
              backup package and review the results.
            </p>

            <div className="workflow-step-list">
              <div className="workflow-step">
                <span className="workflow-step-number">
                  01
                </span>
                <span>
                  <strong>Collect configuration</strong>
                  <small>Gather supported resources</small>
                </span>
              </div>

              <GenesysDevIcon
                icon={GenesysDevIcons.AppChevronRight}
                className="workflow-step-arrow"
              />

              <div className="workflow-step">
                <span className="workflow-step-number">
                  02
                </span>
                <span>
                  <strong>Prepare backup</strong>
                  <small>Organise export results</small>
                </span>
              </div>
            </div>

            <div className="workflow-card-footer">
              <span className="workflow-footer-note">
                Execution integration pending
              </span>

              <DxButton
                type="primary"
                onClick={() => navigate('/app/resources')}
              >
                Open export workspace
                <GenesysDevIcon
                  icon={GenesysDevIcons.AppChevronRight}
                />
              </DxButton>
            </div>
          </article>

          <article className="workflow-card workflow-card-secondary">
            <div className="workflow-card-top">
              <div className="workflow-icon">
                <GenesysDevIcon
                  icon={GenesysDevIcons.AppDataSource}
                />
              </div>
              <span className="placeholder-label">
                Coming soon
              </span>
            </div>

            <h3>Additional resource categories</h3>

            <p>
              Extend the workspace to cover more
              configuration areas over time.
            </p>

            <div className="placeholder-chip-list">
              <span>Users and groups</span>
              <span>Queues and routing</span>
              <span>Divisions</span>
              <span>Data tables</span>
            </div>

            <div className="workflow-card-footer">
              <span className="workflow-footer-note">
                Planned functionality
              </span>

              <DxButton
                type="secondary"
                onClick={() => navigate('/app/resources')}
              >
                View resources
                <GenesysDevIcon
                  icon={GenesysDevIcons.AppChevronRight}
                />
              </DxButton>
            </div>
          </article>
        </div>
      </section>

      <section className="section-block recent-activity-section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">
              Recent export activity
            </h2>
            <p className="section-description">
              Sample records shown to establish the layout.
            </p>
          </div>

          <button
            type="button"
            className="text-action"
            onClick={() => navigate('/app/history')}
          >
            View history
            <GenesysDevIcon
              icon={GenesysDevIcons.AppChevronRight}
            />
          </button>
        </div>

        <div className="panel table-panel">
          <ExportTable compact />
        </div>
      </section>
    </div>
  )
}