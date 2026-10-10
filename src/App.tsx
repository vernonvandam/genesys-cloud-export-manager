import { useEffect, useRef, useState } from 'react'
import platformClient from 'purecloud-platform-client-v2'
import { AlertBlock, DxButton } from 'genesys-react-components'
import { GenesysDevIcon, GenesysDevIcons } from 'genesys-dev-icons'

import './App.scss'

type GenesysUser = {
  id?: string
  name?: string
  email?: string
}

type GenesysConfig = {
  clientId: string
  region: string
  redirectUri: string
}

type WorkspaceView = 'overview' | 'resources' | 'history' | 'settings'
type WorkflowId = 'configuration-export' | 'additional-exports'
type DemoStatus = 'Completed' | 'In progress' | 'Planned'

type DemoExport = {
  id: string
  name: string
  method: string
  status: DemoStatus
  resources: string
  date: string
}

const CONFIG_KEY = 'genesys-app-config'

const navigationItems: {
  id: WorkspaceView
  label: string
  icon: GenesysDevIcons
}[] = [
  { id: 'overview', label: 'Overview', icon: GenesysDevIcons.AppTreeView },
  { id: 'resources', label: 'Resources', icon: GenesysDevIcons.AppDataSource },
  { id: 'history', label: 'Export history', icon: GenesysDevIcons.AppDocumentEye },
  { id: 'settings', label: 'Settings', icon: GenesysDevIcons.DestCog },
]

// Deliberately illustrative data. Replace with real export-run data later.
const demoExports: DemoExport[] = [
  {
    id: 'DEMO-1042',
    name: 'Configuration baseline',
    method: 'Configuration backup',
    status: 'Completed',
    resources: '48 resources',
    date: '09 Oct 2026 Â· 9:15 AM',
  },
  {
    id: 'DEMO-1041',
    name: 'Architect flow configuration',
    method: 'Configuration backup',
    status: 'Completed',
    resources: '14 flows',
    date: '08 Oct 2026 Â· 4:42 PM',
  },
  {
    id: 'DEMO-1040',
    name: 'Queue metadata preview',
    method: 'Resource preview',
    status: 'Planned',
    resources: 'Sample only',
    date: '08 Oct 2026 Â· 11:20 AM',
  },
]

const resourcePlaceholders = [
  {
    title: 'Users and groups',
    description: 'Export users, teams and groups.',
    icon: GenesysDevIcons.AppUserSolid,
  },
  {
    title: 'Queues and routing',
    description: 'Export queue, routing and skill configuration.',
    icon: GenesysDevIcons.IaRouting,
  },
  {
    title: 'Divisions',
    description: 'Export division metadata and assignments.',
    icon: GenesysDevIcons.IaOrganization,
  },
  {
    title: 'Data tables',
    description: 'Export Architect data table configuration.',
    icon: GenesysDevIcons.AppDataSource,
  },
]

function getConfig(): GenesysConfig {
  const params = new URLSearchParams(window.location.search)

  const fromUrl: Partial<GenesysConfig> = {
    clientId: params.get('clientId') || params.get('gc_clientId') || '',
    region: params.get('region') || params.get('gc_region') || '',
    redirectUri:
      params.get('redirectUri') ||
      params.get('redirectURI') ||
      params.get('gc_redirectUrl') ||
      '',
  }

  let saved: Partial<GenesysConfig> = {}
  try {
    saved = JSON.parse(sessionStorage.getItem(CONFIG_KEY) || '{}')
  } catch {
    saved = {}
  }

  const config: GenesysConfig = {
    clientId: fromUrl.clientId || saved.clientId || '',
    region: fromUrl.region || saved.region || '',
    redirectUri: fromUrl.redirectUri || saved.redirectUri || '',
  }

  if (config.clientId && config.region && config.redirectUri) {
    try {
      // Store only non-secret launch configuration across the OAuth redirect.
      sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    } catch {
      // The current page can still use URL configuration if storage is unavailable.
    }
  }

  return config
}

function cleanOAuthCallbackUrl() {
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.hash}`,
  )
}

function getInitials(name?: string) {
  if (!name?.trim()) return 'GC'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StatusPill({ status }: { status: DemoStatus }) {
  const className = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill status-${className}`}>{status}</span>
}

function DemoTag() {
  return (
    <span className="demo-tag">
      <GenesysDevIcon icon={GenesysDevIcons.AppInfoSolid} />
      Demo data
    </span>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="config-row">
      <span className="config-label">{label}</span>
      <span className="config-value">{value || 'Not configured'}</span>
    </div>
  )
}

function ExportTable({ compact = false }: { compact?: boolean }) {
  const exportsToShow = compact ? demoExports.slice(0, 3) : demoExports

  return (
    <div className="table-scroll">
      <table className="export-table">
        <thead>
          <tr>
            <th scope="col">Export</th>
            <th scope="col">Export type</th>
            <th scope="col">Resources</th>
            <th scope="col">Status</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {exportsToShow.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="table-primary-text">{item.name}</span>
                <span className="table-secondary-text">{item.id}</span>
              </td>
              <td>{item.method}</td>
              <td>{item.resources}</td>
              <td><StatusPill status={item.status} /></td>
              <td>{item.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App() {
  const [config] = useState<GenesysConfig>(() => getConfig())
  const [user, setUser] = useState<GenesysUser | null>(null)
  const [status, setStatus] = useState('Not authenticated')
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState<WorkspaceView>('overview')
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowId | null>(null)
  const callbackHandled = useRef(false)

  async function login() {
    setError('')

    if (!config.clientId || !config.region || !config.redirectUri) {
      setStatus('Configuration missing')
      setError('Provide clientId, region and redirectUri as URL parameters.')
      return
    }

    setStatus('Connecting to Genesys Cloud...')

    try {
      const apiClient = platformClient.ApiClient.instance
      apiClient.setEnvironment(config.region)

      await apiClient.loginPKCEGrant(config.clientId, config.redirectUri)
      setStatus('Loading user details...')

      const usersApi = new platformClient.UsersApi()
      const currentUser = (await usersApi.getUsersMe()) as GenesysUser

      setUser(currentUser)
      setStatus('Authenticated successfully')
      cleanOAuthCallbackUrl()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('Authentication failed')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')

    if (oauthError && !callbackHandled.current) {
      callbackHandled.current = true
      setStatus('Authentication failed')
      setError(params.get('error_description') || oauthError)
      cleanOAuthCallbackUrl()
      return
    }

    // The ref prevents a duplicate callback exchange during React Strict Mode effects.
    if (params.has('code') && !callbackHandled.current) {
      callbackHandled.current = true
      void login()
    }
    // Resume PKCE after Genesys redirects to the registered URI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isBusy =
    status === 'Connecting to Genesys Cloud...' ||
    status === 'Loading user details...'

  const alertType =
    status === 'Authenticated successfully'
      ? 'success'
      : status === 'Authentication failed' || status === 'Configuration missing'
        ? 'critical'
        : 'info'

  const statusMessage =
    error ||
    (status === 'Authenticated successfully'
      ? 'Your Genesys Cloud identity was verified successfully.'
      : status === 'Connecting to Genesys Cloud...'
        ? 'Continue the sign-in process in Genesys Cloud.'
        : status === 'Loading user details...'
          ? 'Retrieving your authenticated user profile.'
          : 'Sign in to open your Genesys Cloud export workspace.')

  const pageTitle = navigationItems.find((item) => item.id === activeView)?.label || 'Overview'

  function openExportWorkspace(workflow: WorkflowId = 'configuration-export') {
    setSelectedWorkflow(workflow)
    setActiveView('resources')
  }

  if (!user) {
    return (
      <div className="genesys-app genesys-app-light auth-page">
        <main className="auth-card">
          <header className="auth-heading">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppShieldCheck}
              className="auth-brand-icon"
            />
            <div>
              <p className="eyebrow">GENESYS CLOUD TOOLS</p>
              <h1 className="auth-title">Genesys Cloud Export Manager</h1>
            </div>
          </header>

          <h2 className="auth-subtitle">Sign in to your workspace</h2>
          <p className="auth-description">
            Connect to your Genesys Cloud organisation to export and back up configuration with configuration.
          </p>

          <div className="config-list">
            <ConfigRow label="Client ID" value={config.clientId ? 'Configured' : 'Missing'} />
            <ConfigRow label="Region" value={config.region} />
            <ConfigRow label="Redirect URI" value={config.redirectUri} />
          </div>

          <AlertBlock alertType={alertType} title={status} className="auth-status">
            {statusMessage}
          </AlertBlock>

          <div className="auth-actions">
            <DxButton type="primary" disabled={isBusy} onClick={() => void login()}>
              {isBusy ? 'Connecting...' : 'Login with Genesys Cloud'}
            </DxButton>
          </div>

          <p className="auth-help">
            Uses OAuth Authorization Code with PKCE. No client secret is required in this browser application.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="genesys-app genesys-app-light app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} />
          </div>
          <div className="brand-copy">
            <span className="brand-title">Genesys Cloud</span>
            <span className="brand-subtitle">Export Manager</span>
          </div>
        </div>

        <div className="org-context">
          <span className="connection-dot" />
          <div className="org-context-copy">
            <span className="org-context-label">Connected region</span>
            <span className="org-context-value">{config.region}</span>
          </div>
          <GenesysDevIcon icon={GenesysDevIcons.AppChevronDown} className="org-chevron" />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${activeView === item.id ? ' is-active' : ''}`}
              aria-current={activeView === item.id ? 'page' : undefined}
              onClick={() => {
                setActiveView(item.id)
                if (item.id !== 'resources') setSelectedWorkflow(null)
              }}
            >
              <GenesysDevIcon icon={item.icon} />
              <span>{item.label}</span>
              {item.id === 'history' && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-demo-note">
            <GenesysDevIcon icon={GenesysDevIcons.AppInfoSolid} />
            <span>Dashboard figures are demo data. Export execution is not connected yet.</span>
          </div>
          <button
            type="button"
            className="sidebar-user"
            onClick={() => setActiveView('settings')}
            aria-label="Open connection settings"
          >
            <span className="user-avatar">{getInitials(user.name)}</span>
            <span className="sidebar-user-copy">
              <span className="sidebar-user-name">{user.name || 'Genesys user'}</span>
              <span className="sidebar-user-role">Authenticated session</span>
            </span>
            <GenesysDevIcon icon={GenesysDevIcons.AppEllipsis} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-heading-group">
            <p className="eyebrow">WORKSPACE / {pageTitle.toUpperCase()}</p>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <span className="topbar-connection">
              <span className="connection-dot" />
              Connected
            </span>
            <div className="topbar-user">
              <span className="user-avatar">{getInitials(user.name)}</span>
              <span className="topbar-user-name">{user.name || 'Genesys user'}</span>
            </div>
          </div>
        </header>

        <main className="workspace-content">
          {activeView === 'overview' && (
            <div className="workspace-view">
              <div className="page-intro">
                <div>
                  <h2 className="page-title">Your export workspace</h2>
                  <p className="page-description">
                    Review activity and start working with your Genesys Cloud configuration.
                  </p>
                </div>
                <DemoTag />
              </div>

              <section className="welcome-panel">
                <div className="welcome-copy">
                  <span className="welcome-kicker">WELCOME BACK</span>
                  <h2>{user.name ? `Hello, ${user.name.split(/\s+/)[0]}` : 'Welcome back'}</h2>
                  <p>
                    Your connection is ready. Start a configuration export, or explore additional resource categories.
                  </p>
                </div>
                <div className="welcome-action">
                  <DxButton type="primary" onClick={() => openExportWorkspace()}>
                    <GenesysDevIcon icon={GenesysDevIcons.AppPlus} />
                    Start a new export
                  </DxButton>
                </div>
                <div className="welcome-decoration" aria-hidden="true">
                  <GenesysDevIcon icon={GenesysDevIcons.AppDataSource} />
                </div>
              </section>

              <section className="connection-summary" aria-label="Genesys Cloud connection">
                <div className="connection-summary-icon">
                  <GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} />
                </div>
                <div className="connection-summary-copy">
                  <span className="connection-summary-title">Connected to Genesys Cloud</span>
                  <span className="connection-summary-subtitle">Authenticated as {user.email || user.name || 'current user'}</span>
                </div>
                <span className="region-chip">{config.region}</span>
              </section>

              <section className="metric-grid" aria-label="Demo export statistics">
                <article className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Export runs this month</span>
                    <span className="metric-icon"><GenesysDevIcon icon={GenesysDevIcons.AppRefresh} /></span>
                  </div>
                  <span className="metric-value">12</span>
                  <span className="metric-footnote">Illustrative sample value</span>
                </article>
                <article className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Completed</span>
                    <span className="metric-icon metric-icon-success"><GenesysDevIcon icon={GenesysDevIcons.AppCheckSolid} /></span>
                  </div>
                  <span className="metric-value">10</span>
                  <span className="metric-footnote">Illustrative sample value</span>
                </article>
                <article className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Drafts / planned</span>
                    <span className="metric-icon metric-icon-warning"><GenesysDevIcon icon={GenesysDevIcons.AppDocumentEdit} /></span>
                  </div>
                  <span className="metric-value">2</span>
                  <span className="metric-footnote">Illustrative sample value</span>
                </article>
                <article className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Resource groups</span>
                    <span className="metric-icon"><GenesysDevIcon icon={GenesysDevIcons.AppTreeView} /></span>
                  </div>
                  <span className="metric-value">4</span>
                  <span className="metric-footnote">Sample categories</span>
                </article>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2 className="section-title">Export workflows</h2>
                    <p className="section-description">Start a configuration backup or explore additional resource categories.</p>
                  </div>
                  <button type="button" className="text-action" onClick={() => setActiveView('resources')}>
                    View all resources <GenesysDevIcon icon={GenesysDevIcons.AppChevronRight} />
                  </button>
                </div>

                <div className="workflow-grid">
                  <article className="workflow-card workflow-card-primary">
                    <div className="workflow-card-top">
                      <div className="workflow-icon workflow-icon-primary"><GenesysDevIcon icon={GenesysDevIcons.AppTreeView} /></div>
                      <span className="primary-label">Primary workflow</span>
                    </div>
                    <h3>configuration export</h3>
                    <p>
                      The main workflow for exporting supported Genesys Cloud configuration, including Architect flow configuration supported by the configuration provider.
                    </p>
                    <div className="workflow-step-list">
                      <div className="workflow-step">
                        <span className="workflow-step-number">01</span>
                        <span><strong>Collect</strong><small>Selected configuration</small></span>
                      </div>
                      <GenesysDevIcon icon={GenesysDevIcons.AppChevronRight} className="workflow-step-arrow" />
                      <div className="workflow-step">
                        <span className="workflow-step-number">02</span>
                        <span><strong>Package &amp; backup</strong><small>Review and retain outputs</small></span>
                      </div>
                    </div>
                    <div className="workflow-card-footer">
                      <span className="workflow-footer-note">Execution integration planned</span>
                      <DxButton type="primary" onClick={() => openExportWorkspace()}>
                        Open export workspace <GenesysDevIcon icon={GenesysDevIcons.AppChevronRight} />
                      </DxButton>
                    </div>
                  </article>

                  <article className="workflow-card workflow-card-secondary">
                    <div className="workflow-card-top">
                      <div className="workflow-icon"><GenesysDevIcon icon={GenesysDevIcons.AppDataSource} /></div>
                      <span className="placeholder-label">Coming soon</span>
                    </div>
                    <h3>Additional resource exports</h3>
                    <p>
                      Expand export coverage to additional supported resource categories.
                    </p>
                    <div className="placeholder-chip-list">
                      <span>Users and groups</span>
                      <span>Queues and routing</span>
                      <span>Divisions</span>
                      <span>Data tables</span>
                    </div>
                    <div className="workflow-card-footer">
                      <span className="workflow-footer-note">Placeholders only</span>
                      <DxButton type="secondary" onClick={() => setActiveView('resources')}>
                        View planned exports <GenesysDevIcon icon={GenesysDevIcons.AppChevronRight} />
                      </DxButton>
                    </div>
                  </article>
                </div>
              </section>

              <section className="section-block recent-activity-section">
                <div className="section-heading">
                  <div>
                    <h2 className="section-title">Recent export activity</h2>
                    <p className="section-description">Sample records shown to establish the dashboard layout.</p>
                  </div>
                  <button type="button" className="text-action" onClick={() => setActiveView('history')}>
                    View history <GenesysDevIcon icon={GenesysDevIcons.AppChevronRight} />
                  </button>
                </div>
                <div className="panel table-panel">
                  <ExportTable compact />
                </div>
              </section>
            </div>
          )}

          {activeView === 'resources' && (
            <div className="workspace-view">
              <div className="page-intro">
                <div>
                  <h2 className="page-title">Export resources</h2>
                  <p className="page-description">Choose an export workflow. configuration is the primary export engine.</p>
                </div>
                <DemoTag />
              </div>

              <article className="resource-primary-card">
                <div className="resource-primary-main">
                  <div className="workflow-icon workflow-icon-primary"><GenesysDevIcon icon={GenesysDevIcons.AppTreeView} /></div>
                  <div>
                    <div className="resource-eyebrow-row"><span className="primary-label">Primary workflow</span><span className="method-chip">Configuration export</span></div>
                    <h2 className="resource-title">Configuration export &amp; backup</h2>
                    <p className="resource-description">
                      One workspace for supported Genesys Cloud configuration, including Architect flows where supported by the provider. The dashboard UI is in place; the export runner will be connected in a later stage.
                    </p>
                  </div>
                </div>
                <DxButton type="primary" onClick={() => setSelectedWorkflow(selectedWorkflow === 'configuration-export' ? null : 'configuration-export')}>
                  {selectedWorkflow === 'configuration-export' ? 'Close workspace details' : 'Open export workspace'}
                </DxButton>
              </article>

              {selectedWorkflow === 'configuration-export' && (
                <section className="panel export-workspace-panel">
                  <div className="section-heading">
                    <div>
                      <h3 className="section-title">Configuration export workspace</h3>
                      <p className="section-description">Illustrative setup steps only â€” no commands are executed in this milestone.</p>
                    </div>
                    <span className="placeholder-label">Not connected</span>
                  </div>
                  <div className="setup-step-grid">
                    <div className="setup-step-card">
                      <span className="setup-step-number">01</span>
                      <GenesysDevIcon icon={GenesysDevIcons.AppTreeView} />
                      <h4>Collect configuration</h4>
                      <p>Collect supported configuration from the connected organisation.</p>
                      <span className="step-status">Execution pending</span>
                    </div>
                    <div className="setup-step-card">
                      <span className="setup-step-number">02</span>
                      <GenesysDevIcon icon={GenesysDevIcons.AppDocumentEye} />
                      <h4>Prepare backup package</h4>
                      <p>Package generated outputs, retain timestamped backups and record export results.</p>
                      <span className="step-status">Execution pending</span>
                    </div>
                    <div className="setup-step-card">
                      <span className="setup-step-number">03</span>
                      <GenesysDevIcon icon={GenesysDevIcons.AppCheck} />
                      <h4>Review results</h4>
                      <p>Review output, backups and run status in export history.</p>
                      <span className="step-status">UI placeholder</span>
                    </div>
                  </div>
                  <AlertBlock alertType="info" title="Export runner not connected">
                    This dashboard is currently showing sample data. Export execution is not connected yet. The next integration stage will connect this workspace to the backend export service.
                  </AlertBlock>
                </section>
              )}

              <div className="section-heading section-heading-spaced">
                <div>
                  <h2 className="section-title">Additional resource categories</h2>
                  <p className="section-description">More resource categories can be added here as coverage expands.</p>
                </div>
                <span className="placeholder-label">Not implemented</span>
              </div>
              <div className="resource-placeholder-grid">
                {resourcePlaceholders.map((item) => (
                  <article className="resource-placeholder-card" key={item.title}>
                    <div className="resource-placeholder-icon"><GenesysDevIcon icon={item.icon} /></div>
                    <span className="placeholder-label">Coming soon</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="resource-placeholder-footer">Planned capability</span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeView === 'history' && (
            <div className="workspace-view">
              <div className="page-intro">
                <div>
                  <h2 className="page-title">Export history</h2>
                  <p className="page-description">Review previous export runs. The entries below are illustrative demo records.</p>
                </div>
                <DemoTag />
              </div>
              <div className="history-summary-grid">
                <div className="history-summary-card"><span className="metric-label">Sample records</span><strong>3</strong></div>
                <div className="history-summary-card"><span className="metric-label">Completed in sample</span><strong>2</strong></div>
                <div className="history-summary-card"><span className="metric-label">Planned in sample</span><strong>1</strong></div>
              </div>
              <section className="panel table-panel history-table-panel">
                <div className="panel-heading">
                  <div><h2 className="section-title">All export activity</h2><p className="section-description">Demo records only â€” not retrieved from your organisation.</p></div>
                </div>
                <ExportTable />
              </section>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="workspace-view">
              <div className="page-intro">
                <div>
                  <h2 className="page-title">Settings</h2>
                  <p className="page-description">Review the runtime configuration supplied when this application was launched.</p>
                </div>
              </div>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div className="settings-title-icon"><GenesysDevIcon icon={GenesysDevIcons.AppShieldCheck} /></div>
                  <div><h2 className="section-title">Genesys Cloud connection</h2><p className="section-description">Authenticated session details and non-secret launch configuration.</p></div>
                  <span className="status-pill status-completed">Connected</span>
                </div>
                <div className="settings-config-list">
                  <ConfigRow label="Client ID" value={config.clientId ? 'Configured (hidden)' : 'Missing'} />
                  <ConfigRow label="Region" value={config.region} />
                  <ConfigRow label="Redirect URI" value={config.redirectUri} />
                  <ConfigRow label="Authentication" value="OAuth Authorization Code with PKCE" />
                  <ConfigRow label="Signed-in user" value={user.email || user.name || 'Not provided'} />
                </div>
                <AlertBlock alertType="info" title="Customer-specific configuration">
                  Client ID, region and redirect URI are provided at runtime. This application does not require a client secret in the browser. Export execution is not yet connected to a backend or customer-side agent.
                </AlertBlock>
              </section>
            </div>
          )}
        </main>

        <footer className="app-footer">
          <span>Genesys Cloud Export Manager</span>
          <span><span className="footer-demo-dot" /> Demo dashboard Â· export operations are not connected</span>
        </footer>
      </div>
    </div>
  )
}

