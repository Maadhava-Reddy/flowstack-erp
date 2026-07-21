import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

interface Stats {
  customers: number;
  products: number;
  lowStock: number;
  challans: number;
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [stats, setStats] = useState<Stats>({ customers: 0, products: 0, lowStock: 0, challans: 0 });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [products, low, c, ch] = await Promise.all([
          api.get("/products?limit=1"),
          api.get("/products?low_stock=true&limit=8"),
          api.get("/customers?limit=1"),
          api.get("/challans?limit=1"),
        ]);
        setStats({
          products: products.pagination.total,
          lowStock: low.pagination.total,
          customers: c.pagination.total,
          challans: ch.pagination.total,
        });
        setLowStockItems(low.data);
      } catch {
        /* dashboard is best-effort */
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{greeting()}, {user?.name?.split(" ")[0]} 👋</h2>
          <div className="sub">Here's what's happening in your operations today.</div>
        </div>
        <div className="actions">
          {can("SALES") && (
            <Link className="btn primary" to="/challans/new" id="dashboard-new-challan">
              + New challan
            </Link>
          )}
          {can("WAREHOUSE") && (
            <Link className="btn ghost" to="/stock" id="dashboard-stock-link">
              Record movement
            </Link>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="tiles">
        <div className="tile blue">
          <div className="tile-icon">👥</div>
          <div className="label">Total customers</div>
          <div className="value">{loading ? "—" : stats.customers}</div>
        </div>
        <div className="tile">
          <div className="tile-icon">📦</div>
          <div className="label">Products</div>
          <div className="value">{loading ? "—" : stats.products}</div>
        </div>
        <div className={`tile ${stats.lowStock > 0 ? "warn" : "green"}`}>
          <div className="tile-icon">{stats.lowStock > 0 ? "⚠" : "✓"}</div>
          <div className="label">Low stock alerts</div>
          <div className="value">{loading ? "—" : stats.lowStock}</div>
        </div>
        <div className="tile">
          <div className="tile-icon">🧾</div>
          <div className="label">Total challans</div>
          <div className="value">{loading ? "—" : stats.challans}</div>
        </div>
      </div>

      {/* Low stock alerts table */}
      {!loading && lowStockItems.length > 0 && (
        <div className="card">
          <div className="page-head" style={{ marginBottom: 14 }}>
            <div className="card-title">
              <div className="ct-icon">⚠</div>
              Low stock alerts — {stats.lowStock} item{stats.lowStock !== 1 ? "s" : ""} need restocking
            </div>
            <Link to="/products?low=1" className="btn ghost sm" id="dashboard-view-all-low">
              View all →
            </Link>
          </div>

          <div className="table-wrap" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="num">Current stock</th>
                  <th className="num">Min threshold</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="mono">{p.sku}</td>
                    <td className="num low-stock">{p.current_stock}</td>
                    <td className="num muted">{p.min_stock}</td>
                    <td className="muted">{p.location || "—"}</td>
                    <td>
                      {can("WAREHOUSE") && (
                        <Link className="btn ghost xs" to="/stock" id={`dashboard-restock-${p.id}`}>
                          Restock
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      {!loading && lowStockItems.length === 0 && (
        <div className="card">
          <div className="card-title">
            <div className="ct-icon">✓</div>
            All stock levels are healthy
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            No products are below their minimum stock threshold. Keep it up!
          </p>
        </div>
      )}
    </>
  );
}
