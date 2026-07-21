import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export default function Stock() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    quantity: "",
    movement_type: "IN",
    reason: "",
  });

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/stock-movements?page=${page}&limit=15`);
      setRows(res.data);
      setPages(res.pagination.pages || 1);
      setTotal(res.pagination.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadProducts = async () => {
    const r = await api.get("/products?limit=200");
    setProducts(r.data);
  };

  useEffect(() => { loadMovements(); }, [loadMovements]);
  useEffect(() => { loadProducts(); }, []);

  const submit = async () => {
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      await api.post("/stock-movements", {
        ...form,
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
      });
      setSuccess(`Stock movement recorded: ${form.movement_type} ${form.quantity} units.`);
      setForm({ product_id: "", quantity: "", movement_type: "IN", reason: "" });
      loadMovements();
      loadProducts();
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        setError(e.details.map((d) => `${d.field}: ${d.message}`).join("; "));
      } else {
        setError(e instanceof ApiError ? e.message : "Could not record movement");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => String(p.id) === form.product_id);
  const willGoNegative =
    form.movement_type === "OUT" &&
    selectedProduct &&
    Number(form.quantity) > selectedProduct.current_stock;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Stock movements</h2>
          <div className="sub">{total} movement{total !== 1 ? "s" : ""} recorded</div>
        </div>
      </div>

      {/* Record movement form — warehouse only */}
      {can("WAREHOUSE") && (
        <div className="card">
          <div className="card-title">
            <div className="ct-icon">↕</div>
            Record stock movement
          </div>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          {willGoNegative && (
            <div className="alert error">
              ⚠ This OUT movement exceeds current stock ({selectedProduct.current_stock} units available). The server will reject it.
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              Product <span className="req">*</span>
              <select
                id="stock-product"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — stock: {p.current_stock}
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                  Current stock: <strong>{selectedProduct.current_stock}</strong> units
                  {selectedProduct.current_stock <= selectedProduct.min_stock && (
                    <span style={{ color: "var(--red)", marginLeft: 6 }}>⚠ Below minimum ({selectedProduct.min_stock})</span>
                  )}
                </span>
              )}
            </label>

            <label className="field">
              Movement type <span className="req">*</span>
              <select
                id="stock-type"
                value={form.movement_type}
                onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
              >
                <option value="IN">IN — stock received / returned</option>
                <option value="OUT">OUT — stock removed / damaged</option>
              </select>
            </label>

            <label className="field">
              Quantity <span className="req">*</span>
              <input
                id="stock-quantity"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                style={willGoNegative ? { borderColor: "var(--red)" } : undefined}
              />
            </label>

            <label className="field">
              Reason <span className="req">*</span>
              <input
                id="stock-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Purchase order #PO-2025-001"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              id="stock-submit-btn"
              className={`btn ${form.movement_type === "IN" ? "success" : "danger"}`}
              onClick={submit}
              disabled={!form.product_id || !form.quantity || !form.reason || submitting}
            >
              {submitting
                ? "Saving…"
                : form.movement_type === "IN"
                ? "▲ Record stock IN"
                : "▼ Record stock OUT"}
            </button>
          </div>
        </div>
      )}

      {/* Movement log */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Type</th>
              <th className="num">Qty</th>
              <th>Reason</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px" }} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">↕</div>
                    <p>No stock movements recorded yet</p>
                    <small>Movements are logged automatically when challans are confirmed, or manually above.</small>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((m) => (
                <tr key={m.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {new Date(m.created_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td style={{ fontWeight: 500 }}>{m.product_name}</td>
                  <td className="mono">{m.sku}</td>
                  <td>
                    <span className={`badge ${m.movement_type === "IN" ? "green" : "red"}`}>
                      {m.movement_type === "IN" ? "▲ IN" : "▼ OUT"}
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{m.quantity}</td>
                  <td className="muted" style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.reason}
                  </td>
                  <td className="muted">{m.created_by_name || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          id="stock-prev"
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
          id="stock-next"
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
