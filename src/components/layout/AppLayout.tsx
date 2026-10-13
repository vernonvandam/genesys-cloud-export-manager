import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

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
    mode,
    user,
    organization,
    config,
    status: genesysAuthStatus,
    isBusy: genesysAuthBusy,
    disconnectGenesys,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const profilePopoverRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const {
    user: standaloneUser,
    profile: standaloneProfile,
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    signOut,
  } = useSupabaseAuth();

  useEffect(() => {
    if (!profileOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !profilePopoverRef.current?.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

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
    mode === "integrated"
      ? user?.username || user?.name || user?.email || "Genesys user"
      : standaloneProfile?.display_name || standaloneUser?.email || "Local user";

  const pageTitle =
    navigationItems.find((item) => item.to === location.pathname)
      ?.label ||
    (location.pathname === "/app/admin" ? "Admin" : "Overview");

  const initials = getInitials(displayName);

  const connectionDotClass = isGenesysConnected
    ? "connection-dot"
    : "connection-dot connection-dot-disconnected";

  async function handleSignOut() {
    setSignOutError("");
    try {
      if (mode === "integrated") {
        disconnectGenesys();
      } else {
        await signOut();
      }
      setProfileOpen(false);
      navigate("/", { replace: true });
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
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

        {mode === "integrated" && (
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
        )}

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>

          {navigationItems.map((item) => (
            <div key={item.to}>
              <NavLink
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
              {item.to === "/app/settings" &&
                mode === "standalone" &&
                standaloneProfile?.role === "global_admin" && (
                  <>
                    <div className="nav-divider" role="separator" />
                    <NavLink
                      to="/app/admin"
                      className={({ isActive }) =>
                        `nav-item${isActive ? " is-active" : ""}`
                      }
                    >
                      <GenesysDevIcon icon={GenesysDevIcons.AppUserSolid} />
                      <span>Admin</span>
                    </NavLink>
                  </>
                )}
            </div>
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

          <div className="sidebar-profile-menu" ref={profilePopoverRef}>
            {profileOpen && (
              <section
                className="profile-popover"
                id="sidebar-profile-popover"
                role="dialog"
                aria-label="User profile"
              >
                <div className="profile-popover-heading">
                  <span className="user-avatar">{initials}</span>
                  <div className="profile-popover-identity">
                    <strong>{displayName}</strong>
                    <span>
                      {mode === "integrated"
                        ? "Integrated Genesys user"
                        : standaloneProfile?.role === "global_admin"
                          ? "Global administrator"
                          : "Local user"}
                    </span>
                  </div>
                </div>

                <dl className="profile-details">
                  {mode === "integrated" ? (
                    <>
                      {user?.name && (
                        <div>
                          <dt>Name</dt>
                          <dd>{user.name}</dd>
                        </div>
                      )}
                      {user?.username && (
                        <div>
                          <dt>Username</dt>
                          <dd>{user.username}</dd>
                        </div>
                      )}
                      {user?.email && (
                        <div>
                          <dt>Email</dt>
                          <dd>{user.email}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Genesys user ID</dt>
                        <dd>{user?.id || "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Organization</dt>
                        <dd>{organization?.name || "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Organization ID</dt>
                        <dd>{organization?.id || "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Region</dt>
                        <dd>{config.region || "Unavailable"}</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Email</dt>
                        <dd>{standaloneUser?.email || "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Email verified</dt>
                        <dd>
                          {standaloneUser?.email_confirmed_at ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt>Account ID</dt>
                        <dd>{standaloneProfile?.id || standaloneUser?.id || "Unavailable"}</dd>
                      </div>
                      {standaloneUser?.phone && (
                        <div>
                          <dt>Phone</dt>
                          <dd>{standaloneUser.phone}</dd>
                        </div>
                      )}
                      {standaloneUser?.app_metadata.provider && (
                        <div>
                          <dt>Sign-in provider</dt>
                          <dd>{standaloneUser.app_metadata.provider}</dd>
                        </div>
                      )}
                      {standaloneProfile?.company_name && (
                        <div>
                          <dt>Company</dt>
                          <dd>{standaloneProfile.company_name}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Account role</dt>
                        <dd>
                          {standaloneProfile?.role === "global_admin"
                            ? "Global administrator"
                            : "Organization member"}
                        </dd>
                      </div>
                      <div>
                        <dt>Access status</dt>
                        <dd>{standaloneProfile?.approval_status || "Unavailable"}</dd>
                      </div>
                      {organizations.length ? (
                        organizations.map((item) => (
                          <div key={item.id}>
                            <dt>Organization access</dt>
                            <dd>
                              {item.name} (ID: {item.id}
                              {item.region ? `, region: ${item.region}` : ""})
                            </dd>
                          </div>
                        ))
                      ) : (
                        <div>
                          <dt>Organization access</dt>
                          <dd>None assigned</dd>
                        </div>
                      )}
                      {standaloneProfile?.created_at && (
                        <div>
                          <dt>Account created</dt>
                          <dd>{new Date(standaloneProfile.created_at).toLocaleString()}</dd>
                        </div>
                      )}
                      {standaloneProfile?.updated_at && (
                        <div>
                          <dt>Profile updated</dt>
                          <dd>{new Date(standaloneProfile.updated_at).toLocaleString()}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>

                {signOutError && (
                  <p className="profile-signout-error" role="alert">
                    {signOutError}
                  </p>
                )}
                <button
                  className="profile-signout-button"
                  type="button"
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </button>
              </section>
            )}

            <button
              className="sidebar-user"
              type="button"
              aria-label="Open user profile"
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
              aria-controls="sidebar-profile-popover"
              onClick={() => {
                setSignOutError("");
                setProfileOpen((open) => !open);
              }}
            >
              <span className="user-avatar">{initials}</span>

              <span className="sidebar-user-copy">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-role">
                  {mode === "integrated" ? "Genesys account" : "Local account"}
                </span>
              </span>

              <GenesysDevIcon icon={GenesysDevIcons.AppEllipsis} />
            </button>
          </div>
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
            {mode !== "integrated" && organizations.length > 1 && (
              <label className="organization-picker">
                <span className="sr-only">Active organization</span>
                <select
                  value={activeOrganizationId ?? ""}
                  onChange={(event) =>
                    setActiveOrganizationId(event.target.value)
                  }
                  aria-label="Active organization"
                >
                  {organizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {mode === "integrated" && (
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
            )}

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