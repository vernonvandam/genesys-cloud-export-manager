import {
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom'

import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

import { useAuth } from '../../auth/useAuth'

const navigationItems = [
  {
    to: '/app',
    label: 'Overview',
    icon: GenesysDevIcons.AppTreeView,
    end: true,
  },
  {
    to: '/app/resources',
    label: 'Resources',
    icon: GenesysDevIcons.AppDataSource,
  },
  {
    to: '/app/history',
    label: 'Export history',
    icon: GenesysDevIcons.AppDocumentEye,
  },
  {
    to: '/app/settings',
    label: 'Settings',
    icon: GenesysDevIcons.DestCog,
  },
]

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

export default function AppLayout() {
  const { config, user } = useAuth()
  const location = useLocation()

  const pageTitle =
    navigationItems.find(
      (item) => item.to === location.pathname,
    )?.label || 'Overview'

  const initials = getInitials(user?.name)

  return (
    <div className="genesys-app genesys-app-light app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppShieldCheck}
            />
          </div>

          <div className="brand-copy">
            <span className="brand-title">
              Genesys Cloud
            </span>
            <span className="brand-subtitle">
              Export Manager
            </span>
          </div>
        </div>

        <div className="org-context">
          <span className="connection-dot" />

          <div className="org-context-copy">
            <span className="org-context-label">
              Connected region
            </span>
            <span className="org-context-value">
              {config.region || 'Not configured'}
            </span>
          </div>

          <GenesysDevIcon
            icon={GenesysDevIcons.AppChevronDown}
            className="org-chevron"
          />
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Main navigation"
        >
          <span className="nav-section-label">
            Workspace
          </span>

          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item${isActive ? ' is-active' : ''}`
              }
            >
              <GenesysDevIcon icon={item.icon} />

              <span>{item.label}</span>

              {item.to === '/app/history' && (
                <span className="nav-count">3</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-demo-note">
            <GenesysDevIcon
              icon={GenesysDevIcons.AppInfoSolid}
            />
            <span>
              Dashboard figures are sample data.
              Export execution is not connected yet.
            </span>
          </div>

          <NavLink
            to="/app/settings"
            className="sidebar-user"
            aria-label="Open connection settings"
          >
            <span className="user-avatar">{initials}</span>

            <span className="sidebar-user-copy">
              <span className="sidebar-user-name">
                {user?.name || 'Genesys user'}
              </span>
              <span className="sidebar-user-role">
                Authenticated session
              </span>
            </span>

            <GenesysDevIcon
              icon={GenesysDevIcons.AppEllipsis}
            />
          </NavLink>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-heading-group">
            <p className="eyebrow">
              WORKSPACE / {pageTitle.toUpperCase()}
            </p>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>

          <div className="topbar-right">
            <span className="topbar-connection">
              <span className="connection-dot" />
              Connected
            </span>

            <div className="topbar-user">
              <span className="user-avatar">{initials}</span>
              <span className="topbar-user-name">
                {user?.name || 'Genesys user'}
              </span>
            </div>
          </div>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Genesys Cloud Export Manager</span>

          <span>
            <span className="footer-demo-dot" />
            Demo dashboard · export operations are not
            connected
          </span>
        </footer>
      </div>
    </div>
  )
}