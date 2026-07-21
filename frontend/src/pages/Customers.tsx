import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

const statusBadge: Record<string, string> = {
  LEAD: "blue",
  ACTIVE: "green",
  INACTIVE: "grey",
};

const statusLabel: Record<string, string> = {
  LEAD: "Lead",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export default function Customers() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "12" });
      if (search) q.set("search", search);
      if (status) q.set("status", status);
      if (type) q.set("type", type);
      const res = await api.get(`/customers?${q}`);
      setRows(res.data);
      setPages(res.pagination.pages || 1);
      setTotal(res.pagination.total);
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false);
    }
  }, [search, status, type, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Customers</h2>
          <div className="sub">{total} record{total !== 1 ? "s" : ""} in CRM</div>
        </div>
        <div className="actions">
          {can("SALES") && (
            <Link to="/customers/new" className="btn primary" id="customers-add-btn">
              + Add customer
            </Link>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          id="customers-search"
          placeholder="Search name, mobile, business…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          id="customers-status-filter"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select
          id="customers-type-filter"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Business</th>
              <th>Mobile</th>
              <th>GST</th>
              <th>Type</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center", padding: "32px" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <p>No customers match these filters</p>
                    <small>Try adjusting your search or add a new customer.</small>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link to={`/customers/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="muted">{c.business_name || "—"}</td>
                  <td className="mono">{c.mobile}</td>
                  <td className="mono muted">{c.gst_number || "—"}</td>
                  <td>
                    <span className="badge grey">{c.customer_type}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[c.status] || "grey"}`}>
                      {statusLabel[c.status] || c.status}
                    </span>
                  </td>
                  <td className="muted">
                    {c.follow_up_date ? (
                      <span style={{
                        color: new Date(c.follow_up_date) < new Date() ? "var(--red)" : undefined,
                        fontWeight: new Date(c.follow_up_date) < new Date() ? 600 : undefined,
                      }}>
                        {c.follow_up_date.slice(0, 10)}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    {can("SALES") && (
                      <Link
                        className="btn ghost sm"
                        to={`/customers/${c.id}/edit`}
                        id={`customer-edit-${c.id}`}
                      >
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="btn ghost sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          id="customers-prev-page"
        >
          ← Previous
        </button>
        <span>
          Page {page} of {pages} &nbsp;·&nbsp; {total} total
        </span>
        <button
          className="btn ghost sm"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          id="customers-next-page"
        >
          Next →
        </button>
      </div>
    </>
  );
}
