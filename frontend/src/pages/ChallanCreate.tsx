import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";

interface Line {
  product_id: string;
  quantity: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ChallanCreate() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers?limit=200&status=ACTIVE").then((r) => setCustomers(r.data));
    api.get("/products?limit=200").then((r) => setProducts(r.data));
  }, []);

  const setLine = (i: number, k: keyof Line, v: string) => {
    const next = [...lines];
    next[i] = { ...next[i], [k]: v };
    setLines(next);
  };

  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));

  const addLine = () => setLines([...lines, { product_id: "", quantity: "" }]);

  const productById = (pid: string) => products.find((p) => String(p.id) === pid);

  const totals = lines.reduce(
    (acc, l) => {
      const p = productById(l.product_id);
      const q = Number(l.quantity) || 0;
      if (p && q > 0) { acc.qty += q; acc.amount += q * Number(p.unit_price); }
      return acc;
    },
    { qty: 0, amount: 0 }
  );

  const save = async (status: "DRAFT" | "CONFIRMED") => {
    setError(""); setSaving(true);
    try {
      const items = lines
        .filter((l) => l.product_id && Number(l.quantity) > 0)
        .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));

      if (items.length === 0) {
        setError("Add at least one product with a positive quantity.");
        setSaving(false);
        return;
      }

      const res = await api.post("/challans", { customer_id: Number(customerId), status, items });
      navigate(`/challans/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.details ? e.details.map((d) => `${d.field}: ${d.message}`).join("; ") : e.message);
      } else {
        setError("Could not save challan. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
  const valid = Boolean(customerId) && validLines.length > 0;

  // Detect any line where qty > available stock (client-side warning only)
  const hasOverStock = lines.some((l) => {
    const p = productById(l.product_id);
    return p && Number(l.quantity) > p.current_stock;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <button
              className="btn ghost sm"
              onClick={() => navigate("/challans")}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ← Challans
            </button>
          </div>
          <h2>New sales challan</h2>
          <div className="sub">Create a draft or confirm immediately to deduct stock</div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {hasOverStock && (
        <div className="alert warn">
          One or more lines exceed available stock. Confirming will fail with a 422 error — save as draft first or reduce quantities.
        </div>
      )}

      <div className="card">
        <div className="form-section-title">Customer</div>
        <label className="field" style={{ maxWidth: 480 }}>
          Bill to customer <span className="req">*</span>
          <select
            id="challan-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.business_name ? ` — ${c.business_name}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="divider" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="form-section-title" style={{ marginBottom: 0 }}>Line items</div>
          <button
            id="challan-add-line"
            className="btn ghost sm"
            onClick={addLine}
          >
            + Add row
          </button>
        </div>

        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Product</th>
                <th className="num" style={{ minWidth: 90 }}>Available</th>
                <th className="num" style={{ minWidth: 100 }}>Unit price</th>
                <th style={{ minWidth: 120 }}>Quantity</th>
                <th className="num" style={{ minWidth: 120 }}>Line total</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = productById(l.product_id);
                const q = Number(l.quantity) || 0;
                const overStock = p && q > p.current_stock;
                return (
                  <tr key={i}>
                    <td>
                      <select
                        id={`line-product-${i}`}
                        value={l.product_id}
                        onChange={(e) => setLine(i, "product_id", e.target.value)}
                        style={{ marginTop: 0, minWidth: 200 }}
                      >
                        <option value="">Select product…</option>
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name} ({pr.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`num${overStock ? " low-stock" : ""}`} style={{ fontWeight: overStock ? 700 : undefined }}>
                      {p ? p.current_stock : "—"}
                      {overStock && <span title="Exceeds available stock"> ⚠</span>}
                    </td>
                    <td className="num">
                      {p ? `₹${fmt(Number(p.unit_price))}` : "—"}
                    </td>
                    <td>
                      <input
                        id={`line-qty-${i}`}
                        type="number"
                        min="1"
                        value={l.quantity}
                        style={{ marginTop: 0, width: 90, borderColor: overStock ? "var(--red)" : undefined }}
                        onChange={(e) => setLine(i, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {p && q > 0 ? `₹${fmt(q * Number(p.unit_price))}` : "—"}
                    </td>
                    <td>
                      {lines.length > 1 && (
                        <button
                          id={`line-remove-${i}`}
                          className="btn danger sm"
                          onClick={() => removeLine(i)}
                          title="Remove this line"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals bar */}
        {totals.qty > 0 && (
          <div className="totals-bar">
            <div className="t-item">
              <div className="t-label">Total quantity</div>
              <div className="t-value">{totals.qty}</div>
            </div>
            <div style={{ width: 1, height: 36, background: "var(--line)" }} />
            <div className="t-item">
              <div className="t-label">Total amount</div>
              <div className="t-value">₹{fmt(totals.amount)}</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <span className="badge grey">{validLines.length} line{validLines.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 18 }}>
          <button
            id="challan-save-draft"
            className="btn ghost"
            onClick={() => save("DRAFT")}
            disabled={!valid || saving}
          >
            Save as draft
          </button>
          <button
            id="challan-confirm-btn"
            className="btn primary"
            onClick={() => save("CONFIRMED")}
            disabled={!valid || saving || hasOverStock}
          >
            {saving ? "Saving…" : "✓ Confirm & deduct stock"}
          </button>
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          <strong>Draft</strong> — saved but stock is not deducted yet. &nbsp;
          <strong>Confirm</strong> — stock is deducted atomically; insufficient stock returns an error and nothing is saved.
        </p>
      </div>
    </>
  );
}
