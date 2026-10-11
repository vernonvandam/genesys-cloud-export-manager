import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  GenesysDevIcon,
  GenesysDevIcons,
} from "genesys-dev-icons";

import { useAuth } from "../../auth/useAuth";
import { useSupabaseAuth } from "../../auth/useSupabaseAuth";

const navigationItems = [
  {
    to: "/app",
    label: "Overview",
    icon: GenesysDevIcons.AppTreeView,
    end: true,
  },
  {
    to: "/app/resources",
    label: "Resources",
    icon: GenesysDevIcons.AppDataSource,
  },
  {
    to: "/app/history",
    label: "Export history",
    icon: GenesysDevIcons.AppDocumentEye,
  },
  {
    to: "/app/settings",
    label: "Settings",
    icon: GenesysDevIcons.DestCog,
  },
];

function getInitials(name?: string) {
  if (!name?.trim()) return "GC";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AppLayout() {
  const {
    user,
    organization,
    status: genesysAuthStatus,
    isBusy: genesysAuthBusy,
  } = useAuth();

  const location = useLocation();

  const {
    user: standaloneUser,
    profile: standaloneProfile,
  } = useSupabaseAuth();

  // Only report connected when both identities are present and
  // Genesys authentication has completed successfully.
  const isGenesysConnected =
    genesysAuthStatus === "Authenticated successfully" &&
    Boolean(user?.id && organization?.id);

  const organizationName =
    organization?.name?.trim() || organization?.id || "";

  const connectionStatusText = isGenesysConnected
    ? `Connected to ${organizationName}`
    : genesysAuthBusy
      ? "Connecting to Genesys Cloud..."
      : genesysAuthStatus === "Authentication failed"
        ? "Authentication failed — check Settings"
        : "Not connected — open Settings";

  const connectionStatusTitle = isGenesysConnected
    ? `Connected to ${organizationName}`
    : genesysAuthBusy
      ? "Genesys Cloud authentication is in progress"
      : genesysAuthStatus === "Authentication failed"
        ? "Genesys authentication failed. Open Settings to review the connection."
        : "Genesys Cloud is not connected. Open Settings to connect.";

  const topbarStatusText = isGenesysConnected
    ? "Connected"
    : genesysAuthBusy
      ? "Connecting"
      : "Not connected";

  const displayName =
    (isGenesysConnected ? user?.name : undefined) ||
    standaloneProfile?.display_name ||
    standaloneUser?.email ||
    "User";

  const pageTitle =
    navigationItems.find((item) => item.to === location.pathname)
      ?.label || "Overview";

  const initials = getInitials(displayName);

  const connectionDotClass = isGenesysConnected
    ? "connection-dot"
    : "connection-dot connection-dot-disconnected";

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

        {/* Dynamic Genesys connection status */}
        <div
          className="org-context"
          title={connectionStatusTitle}
          aria-live="polite"
        >
          <span
            className={connectionDotClass}
            aria-hidden="true"
          />

          <div className="org-context-copy">
            <span className="org-context-label">
              Genesys Cloud Auth status
            </span>

            <span className="org-context-value">
              {connectionStatusText}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>

          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item${isActive ? " is-active" : ""}`
              }
            >
              <GenesysDevIcon icon={item.icon} />

              <span>{item.label}</span>

              {item.to === "/app/history" && (
                <span className="nav-count">3</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-demo-note">
            <GenesysDevIcon icon={GenesysDevIcons.AppInfoSolid} />
            <span>
              Dashboard figures are sample data. Export execution
              is not connected yet.
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
                {displayName}
              </span>
              <span className="sidebar-user-role">
                Export Manager account
              </span>
            </span>

            <GenesysDevIcon icon={GenesysDevIcons.AppEllipsis} />
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
            {/* This badge updates from AuthContext */}
            <span
              className={`topbar-connection${
                isGenesysConnected
                  ? ""
                  : " topbar-connection-disconnected"
              }`}
              title={connectionStatusTitle}
              aria-live="polite"
            >
              <span
                className={connectionDotClass}
                aria-hidden="true"
              />
              {topbarStatusText}
            </span>

            <div className="topbar-user">
              <span className="user-avatar">{initials}</span>
              <span className="topbar-user-name">
                {displayName}
              </span>
            </div>
          </div>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Genesys Cloud Export Manager</span>
        </footer>
      </div>
    </div>
  );
}