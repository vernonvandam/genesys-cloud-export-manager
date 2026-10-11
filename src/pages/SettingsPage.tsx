import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertBlock,
} from 'genesys-react-components'
import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'
import { v4 as uuidv4 } from 'uuid'

import { useAuth } from '../auth/useAuth'
import ConfigRow from '../components/common/ConfigRow'

type ToolingConfiguration = {
  id: string
  name: string
  environment: string
  endpoint: string
  description: string
  enabled: boolean
}

type ToolingFormData = Omit<
  ToolingConfiguration,
  'id'
>

const EMPTY_FORM: ToolingFormData = {
  name: '',
  environment: 'Production',
  endpoint: '',
  description: '',
  enabled: true,
}

function readToolingConfigurations(
  storageKey: string,
): ToolingConfiguration[] {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(storageKey) || '[]',
    )

    if (!Array.isArray(saved)) return []

    return saved.filter(
      (item): item is ToolingConfiguration =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.environment === 'string' &&
        typeof item.endpoint === 'string' &&
        typeof item.description === 'string' &&
        typeof item.enabled === 'boolean',
    )
  } catch {
    return []
  }
}

export default function SettingsPage() {
  const {
    config,
    user,
    organization,
  } = useAuth()

  const storageKey =
    `genesys-tooling-configurations:${
      organization?.id || 'unlinked'
    }`

  const [toolingConfigurations, setToolingConfigurations] =
    useState<ToolingConfiguration[]>(
      () => readToolingConfigurations(storageKey),
    )

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [formData, setFormData] =
    useState<ToolingFormData>({ ...EMPTY_FORM })

  const [formError, setFormError] = useState('')

  // Persist non-sensitive profile metadata for this browser
  // session. Real connection credentials will be handled
  // by the backend and secure secret storage.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(toolingConfigurations),
      )
    } catch {
      // The screen remains usable for the current session.
    }
  }, [storageKey, toolingConfigurations])

  function openNewForm() {
    setEditingId(null)
    setFormData({ ...EMPTY_FORM })
    setFormError('')
    setFormOpen(true)
  }

  function openEditForm(
    item: ToolingConfiguration,
  ) {
    setEditingId(item.id)

    setFormData({
      name: item.name,
      environment: item.environment,
      endpoint: item.endpoint,
      description: item.description,
      enabled: item.enabled,
    })

    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setFormData({ ...EMPTY_FORM })
    setFormError('')
  }

  function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError('')

    const name = formData.name.trim()

    if (!name) {
      setFormError(
        'Enter a name for this tooling configuration.',
      )
      return
    }

    const endpoint = formData.endpoint.trim()

    if (endpoint) {
      try {
        const parsed = new URL(endpoint)

        if (
          parsed.protocol !== 'https:' &&
          parsed.protocol !== 'http:'
        ) {
          throw new Error('Unsupported URL protocol')
        }
      } catch {
        setFormError(
          'Enter a valid HTTP or HTTPS URL, or leave the endpoint blank.',
        )
        return
      }
    }

    if (editingId) {
      setToolingConfigurations((current) =>
        current.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...formData,
                name,
                endpoint,
              }
            : item,
        ),
      )
    } else {
      const newConfiguration: ToolingConfiguration = {
        id: uuidv4(),
        ...formData,
        name,
        endpoint,
      }

      setToolingConfigurations((current) => [
        ...current,
        newConfiguration,
      ])
    }

    closeForm()
  }

  function handleRemove(
    item: ToolingConfiguration,
  ) {
    const confirmed = window.confirm(
      `Remove the tooling configuration "${item.name}"?`,
    )

    if (!confirmed) return

    setToolingConfigurations((current) =>
      current.filter(
        (configuration) =>
          configuration.id !== item.id,
      ),
    )

    if (editingId === item.id) {
      closeForm()
    }
  }

  function toggleEnabled(
    item: ToolingConfiguration,
  ) {
    setToolingConfigurations((current) =>
      current.map((configuration) =>
        configuration.id === item.id
          ? {
              ...configuration,
              enabled: !configuration.enabled,
            }
          : configuration,
      ),
    )
  }

  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-description">
            Manage your organisation connection and
            configuration profiles.
          </p>
        </div>
      </div>

      {/* Existing Genesys Cloud connection panel */}
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

          <span
            className={`status-pill ${
              organization?.id
                ? 'status-completed'
                : 'status-planned'
            }`}
          >
            {organization?.id
              ? 'Connected'
              : 'Not connected'}
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

          <ConfigRow
            label="Connected organisation"
            value={
              organization?.name ||
              organization?.id ||
              'Not connected'
            }
          />

          <ConfigRow
            label="Organisation ID"
            value={
              organization?.id ||
              'Not identified'
            }
          />
        </div>

        <AlertBlock
          alertType="info"
          title="Genesys user connection"
        >
          This connection represents the currently
          authenticated Genesys user. Automation
          connections will be managed separately.
        </AlertBlock>
      </section>

      {/* New tooling configurations section */}
      <section className="panel tooling-panel">
        <div className="tooling-section-heading">
          <div>
            <h2 className="section-title">
              Tooling configurations
            </h2>

            <p className="section-description">
              Add and manage named configuration profiles
              for the export services.
            </p>
          </div>

          <button
            type="button"
            className="tooling-primary-button"
            onClick={() => {
              if (!formOpen) {
                openNewForm()
              } else {
                closeForm()
              }
            }}
          >
            {formOpen ? 'Close form' : '+ Add configuration'}
          </button>
        </div>

        <div className="tooling-notice">
          These profiles currently store basic configuration
          details only. Live connections and secure credential
          management will be added through the backend.
        </div>

        {formOpen && (
          <form
            className="tooling-form"
            onSubmit={handleSave}
          >
            <h3 className="tooling-form-title">
              {editingId
                ? 'Edit tooling configuration'
                : 'Add tooling configuration'}
            </h3>

            {formError && (
              <AlertBlock
                alertType="critical"
                title="Check the form"
              >
                {formError}
              </AlertBlock>
            )}

            <div className="tooling-form-grid">
              <label className="tooling-field">
                <span>Configuration name</span>

                <input
                  className="auth-input"
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Production export"
                  required
                  maxLength={100}
                />
              </label>

              <label className="tooling-field">
                <span>Environment</span>

                <select
                  className="auth-input"
                  value={formData.environment}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      environment: event.target.value,
                    }))
                  }
                >
                  <option value="Production">
                    Production
                  </option>
                  <option value="Test">
                    Test
                  </option>
                  <option value="Development">
                    Development
                  </option>
                </select>
              </label>

              <label className="tooling-field tooling-field-full">
                <span>Connection endpoint (optional)</span>

                <input
                  className="auth-input"
                  type="url"
                  value={formData.endpoint}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      endpoint: event.target.value,
                    }))
                  }
                  placeholder="https://service.example.com"
                />

                <span className="auth-field-help">
                  This is stored as profile metadata only;
                  it does not establish a live connection.
                </span>
              </label>

              <label className="tooling-field tooling-field-full">
                <span>Description / notes</span>

                <textarea
                  className="tooling-textarea"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe when this configuration is used."
                  rows={3}
                  maxLength={1000}
                />
              </label>
            </div>

            <label className="tooling-enabled-field">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />

              <span>Configuration enabled</span>
            </label>

            <div className="tooling-form-actions">
              <button
                type="button"
                className="tooling-secondary-button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="tooling-primary-button"
              >
                {editingId
                  ? 'Save changes'
                  : 'Add configuration'}
              </button>
            </div>
          </form>
        )}

        {toolingConfigurations.length === 0 ? (
          <div className="tooling-empty-state">
            <div className="tooling-empty-icon">
              <GenesysDevIcon
                icon={GenesysDevIcons.AppDataSource}
              />
            </div>

            <h3>No tooling configurations yet</h3>

            <p>
              Add a configuration profile to start
              organising the connections used by export
              services.
            </p>

            {!formOpen && (
              <button
                type="button"
                className="tooling-secondary-button"
                onClick={openNewForm}
              >
                Add your first configuration
              </button>
            )}
          </div>
        ) : (
          <div className="tooling-config-list">
            {toolingConfigurations.map((item) => (
              <article
                className="tooling-config-card"
                key={item.id}
              >
                <div className="tooling-config-main">
                  <div className="tooling-config-icon">
                    <GenesysDevIcon
                      icon={GenesysDevIcons.AppDataSource}
                    />
                  </div>

                  <div className="tooling-config-copy">
                    <div className="tooling-config-title-row">
                      <h3>{item.name}</h3>

                      <span
                        className={`status-pill ${
                          item.enabled
                            ? 'status-completed'
                            : 'status-planned'
                        }`}
                      >
                        {item.enabled
                          ? 'Enabled'
                          : 'Disabled'}
                      </span>
                    </div>

                    <span className="tooling-config-environment">
                      {item.environment}
                    </span>

                    {item.description && (
                      <p>{item.description}</p>
                    )}

                    {item.endpoint && (
                      <span className="tooling-config-endpoint">
                        Endpoint: {item.endpoint}
                      </span>
                    )}
                  </div>
                </div>

                <div className="tooling-card-actions">
                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={() => toggleEnabled(item)}
                  >
                    {item.enabled
                      ? 'Disable'
                      : 'Enable'}
                  </button>

                  <button
                    type="button"
                    className="tooling-secondary-button"
                    onClick={() => openEditForm(item)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="tooling-danger-button"
                    onClick={() => handleRemove(item)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}