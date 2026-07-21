import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

const badge: Record<string, string> = {
  DRAFT: "amber",
  CONFIRMED: "green",
  CANCELLED: "red",
};

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Challans() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "12" });
      if (status) q.set("status", status);
      if (search) q.set("search", search);
      const res = await api.get(`/challans?${q}`);
      setRows(res.data);
      setPages(res.pagination.pages || 1);
      setTotal(res.pagination.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Sales challans</h2>
          <div className="sub">{total} challan{total !== 1 ? "s" : ""}</div>
        </div>
        <div className="actions">
          {can("SALES") && (
            <Link to="/challans/new" className="btn primary" id="challans-new-btn">
              + New challan
            </Link>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          id="challans-search"
          placeholder="Search challan no. or customer…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          id="challans-status-filter"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Challan no.</th>
              <th>Customer</th>
              <th className="num">Total qty</th>
              <th className="num">Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th>Created by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "32px" }} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-icon">🧾</div>
                    <p>{status ? `No ${status.toLowerCase()} challans` : "No challans yet"}</p>
                    <small>
                      {can("SALES")
                        ? "Create your first challan to dispatch goods to a customer."
                        : "No sales challans have been created yet."}
                    </small>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    <Link to={`/challans/${c.id}`} id={`challan-link-${c.id}`}>
                      {c.challan_number}
                    </Link>
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
                  <td className="num">{c.total_quantity}</td>
                  <td className="num" style={{ fontWeight: 600 }}>₹{fmt(Number(c.total_amount))}</td>
                  <td>
                    <span className={`badge ${badge[c.status] || "grey"}`}>{c.status}</span>
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {new Date(c.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="muted">{c.created_by_name || "—"}</td>
                  <td>
                    <Link className="btn ghost sm" to={`/challans/${c.id}`} id={`challan-view-${c.id}`}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          id="challans-prev"
          className="btn ghost sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Previous
        </button>
        <span>
          Page {page} of {pages} &nbsp;·&nbsp; {total} total
        </span>
        <button
          id="challans-next"
          className="btn ghost sm"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </>
  );
}
