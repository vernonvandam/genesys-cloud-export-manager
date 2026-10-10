import { useState } from 'react'
import {
  AlertBlock,
  DxButton,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import DemoTag from '../components/common/DemoTag'
import { resourceCategories } from '../data/demoData'

export default function ResourcesPage() {
  const [showWorkspace, setShowWorkspace] =
    useState(false)

  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">
            Export resources
          </h2>
          <p className="page-description">
            Configure a backup workflow or review
            additional resource categories.
          </p>
        </div>
        <DemoTag />
      </div>

      <article className="resource-primary-card">
        <div className="resource-primary-main">
          <div className="workflow-icon workflow-icon-primary">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppTreeView}
            />
          </div>

          <div>
            <div className="resource-eyebrow-row">
              <span className="primary-label">
                Primary workflow
              </span>
            </div>

            <h2 className="resource-title">
              Configuration export &amp; backup
            </h2>

            <p className="resource-description">
              Collect supported Genesys Cloud configuration,
              prepare a backup package and review the
              resulting files. The dashboard is in place;
              execution is a later integration stage.
            </p>
          </div>
        </div>

        <DxButton
          type="primary"
          onClick={() =>
            setShowWorkspace((current) => !current)
          }
        >
          {showWorkspace
            ? 'Close workspace details'
            : 'Open export workspace'}
        </DxButton>
      </article>

      {showWorkspace && (
        <section className="panel export-workspace-panel">
          <div className="section-heading">
            <div>
              <h3 className="section-title">
                Configuration export workspace
              </h3>
              <p className="section-description">
                These steps are illustrative. No export
                operation is executed from this page yet.
              </p>
            </div>

            <span className="placeholder-label">
              Not connected
            </span>
          </div>

          <div className="setup-step-grid">
            <div className="setup-step-card">
              <span className="setup-step-number">01</span>
              <GenesysDevIcon
                icon={GenesysDevIcons.AppTreeView}
              />
              <h4>Collect configuration</h4>
              <p>
                Gather the supported configuration
                resources from the organisation.
              </p>
              <span className="step-status">
                Execution pending
              </span>
            </div>

            <div className="setup-step-card">
              <span className="setup-step-number">02</span>
              <GenesysDevIcon
                icon={GenesysDevIcons.AppDocumentEye}
              />
              <h4>Prepare backup package</h4>
              <p>
                Organise exported files and retain
                previous backup versions.
              </p>
              <span className="step-status">
                Execution pending
              </span>
            </div>

            <div className="setup-step-card">
              <span className="setup-step-number">03</span>
              <GenesysDevIcon
                icon={GenesysDevIcons.AppCheck}
              />
              <h4>Review results</h4>
              <p>
                Check the export status and review
                the resulting backup.
              </p>
              <span className="step-status">
                UI placeholder
              </span>
            </div>
          </div>

          <AlertBlock
            alertType="info"
            title="Export execution not connected"
          >
            This workspace currently uses sample data.
            Connecting it to the backend is a later
            integration step.
          </AlertBlock>
        </section>
      )}

      <div className="section-heading section-heading-spaced">
        <div>
          <h2 className="section-title">
            Additional resource categories
          </h2>
          <p className="section-description">
            Further configuration areas that can be
            added to the export workspace.
          </p>
        </div>

        <span className="placeholder-label">
          Planned
        </span>
      </div>

      <div className="resource-placeholder-grid">
        {resourceCategories.map((item) => (
          <article
            className="resource-placeholder-card"
            key={item.title}
          >
            <div className="resource-placeholder-icon">
              <GenesysDevIcon
                icon={
                  item.title === 'Users and groups'
                    ? GenesysDevIcons.AppUserSolid
                    : item.title === 'Queues and routing'
                      ? GenesysDevIcons.IaRouting
                      : item.title === 'Divisions'
                        ? GenesysDevIcons.IaOrganization
                        : GenesysDevIcons.AppDataSource
                }
              />
            </div>

            <span className="placeholder-label">
              Coming soon
            </span>

            <h3>{item.title}</h3>
            <p>{item.description}</p>

            <span className="resource-placeholder-footer">
              Planned functionality
            </span>
          </article>
        ))}
      </div>
    </div>
  )
}