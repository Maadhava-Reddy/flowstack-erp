import { NavLink } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../auth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            <div className="logo-icon">F</div>
            <div>
              <h1>Flow<span>Stack</span></h1>
              <small>ERP + CRM</small>
            </div>
          </div>
        </div>

        <nav>
          <div className="nav-section">Overview</div>
          <NavLink to="/" end>
            <span className="nav-icon">⊞</span>
            Dashboard
          </NavLink>

          {can("SALES", "ACCOUNTS", "WAREHOUSE") && (
            <>
              <div className="nav-section">CRM</div>
              <NavLink to="/customers">
                <span className="nav-icon">👥</span>
                Customers
              </NavLink>
            </>
          )}

          <div className="nav-section">Warehouse</div>
          <NavLink to="/products">
            <span className="nav-icon">📦</span>
            Products
          </NavLink>
          <NavLink to="/stock">
            <span className="nav-icon">↕</span>
            Stock movements
          </NavLink>

          {can("SALES", "ACCOUNTS", "WAREHOUSE") && (
            <>
              <div className="nav-section">Sales</div>
              <NavLink to="/challans">
                <span className="nav-icon">🧾</span>
                Sales challans
              </NavLink>
            </>
          )}
        </nav>

        <div className="userbox">
          <div className="user-info">
            <div className="avatar">{initials}</div>
            <div>
              <div className="name">{user?.name}</div>
              <div className="role-tag">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout}>
            <span style={{ fontSize: 13 }}>⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
