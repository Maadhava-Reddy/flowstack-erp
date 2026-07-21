import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

const badge: Record<string, string> = { DRAFT: "amber", CONFIRMED: "green", CANCELLED: "red" };

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ChallanDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<"confirm" | "cancel" | null>(null);

  const load = () =>
    api
      .get(`/challans/${id}`)
      .then(setC)
      .catch(() => setError("Challan not found."));

  useEffect(() => { load(); }, [id]);

  const act = async (action: "confirm" | "cancel") => {
    setConfirmDialog(null);
    setError("");
    setBusy(true);
    try {
      await api.patch(`/challans/${id}/${action}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!c && !error) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px" }}>
        <p className="muted">Loading challan…</p>
      </div>
    );
  }

  if (error && !c) {
    return (
      <div>
        <div className="alert error">{error}</div>
        <button className="btn ghost" onClick={() => navigate("/challans")}>
          ← Back to challans
        </button>
      </div>
    );
  }

  const snap = c.customer_snapshot || {};

  return (
    <>
      {/* Confirm dialog overlay */}
      {confirmDialog && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: "90vw", margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-title" style={{ marginBottom: 10 }}>
              {confirmDialog === "confirm" ? "✓ Confirm challan?" : "✕ Cancel challan?"}
            </div>
            {confirmDialog === "confirm" ? (
              <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 18 }}>
                This will <strong>deduct stock</strong> for all items on this challan. If any product has
                insufficient stock, the entire operation will be rolled back.
              </p>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 18 }}>
                {c.status === "CONFIRMED"
                  ? "Stock will be restored for all items on this challan."
                  : "The challan will be marked as cancelled. This cannot be undone."}
              </p>
            )}
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button
                id={`challan-${confirmDialog}-confirm`}
                className={`btn ${confirmDialog === "confirm" ? "primary" : "danger"}`}
                onClick={() => act(confirmDialog)}
                disabled={busy}
              >
                {busy ? "Processing…" : confirmDialog === "confirm" ? "Yes, confirm" : "Yes, cancel"}
              </button>
              <button className="btn ghost" onClick={() => setConfirmDialog(null)}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

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
          <h2 className="mono" style={{ fontSize: 24, letterSpacing: -0.5 }}>{c.challan_number}</h2>
          <div className="sub">
            Created {new Date(c.created_at).toLocaleString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
            {c.created_by_name && ` by ${c.created_by_name}`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`badge ${badge[c.status]}`} style={{ fontSize: 12, padding: "4px 12px" }}>
            {c.status}
          </span>

          <button
            className="btn ghost"
            onClick={() => window.print()}
            style={{ gap: 6 }}
            title="Print or export as PDF"
          >
            🖨️ Print / PDF
          </button>

          {can("SALES") && c.status === "DRAFT" && (
            <button
              id="challan-confirm-btn"
              className="btn primary"
              onClick={() => setConfirmDialog("confirm")}
              disabled={busy}
            >
              ✓ Confirm (deducts stock)
            </button>
          )}
          {can("SALES") && c.status !== "CANCELLED" && (
            <button
              id="challan-cancel-btn"
              className="btn danger"
              onClick={() => setConfirmDialog("cancel")}
              disabled={busy}
            >
              ✕ Cancel challan
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {c.status === "DRAFT" && (
        <div className="alert info">
          This challan is in <strong>DRAFT</strong> status — stock has not been deducted. Confirm it to dispatch.
        </div>
      )}
      {c.status === "CANCELLED" && (
        <div className="alert warn">
          This challan was cancelled. {c.status === "CANCELLED" ? "If it was confirmed before cancellation, stock has been restored." : ""}
        </div>
      )}

      {/* Customer snapshot */}
      <div className="card">
        <div className="card-title">
          <div className="ct-icon">👤</div>
          Customer — snapshot at time of creation
        </div>
        <div className="detail-grid">
          <div className="item"><div className="k">Name</div><div className="v" style={{ fontWeight: 600 }}>{snap.name}</div></div>
          <div className="item"><div className="k">Business</div><div className="v">{snap.business_name || "—"}</div></div>
          <div className="item"><div className="k">Mobile</div><div className="v mono">{snap.mobile}</div></div>
          <div className="item"><div className="k">GST</div><div className="v mono">{snap.gst_number || "—"}</div></div>
          <div className="item"><div className="k">Type</div><div className="v"><span className="badge grey">{snap.customer_type}</span></div></div>
          {snap.address && (
            <div className="item" style={{ gridColumn: "span 2" }}>
              <div className="k">Address</div>
              <div className="v">{snap.address}</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <Link className="btn ghost sm" to={`/customers/${c.customer_id}`} id="challan-view-customer">
            View live customer record →
          </Link>
        </div>
      </div>

      {/* Line items */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)" }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <div className="ct-icon">📋</div>
            Line items
          </div>
        </div>
        <div className="table-wrap" style={{ marginBottom: 0, border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>SKU</th>
                <th className="num">Unit price</th>
                <th className="num">Qty</th>
                <th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="muted">{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                  <td className="mono">{it.sku}</td>
                  <td className="num">₹{fmt(Number(it.unit_price))}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{it.quantity}</td>
                  <td className="num" style={{ fontWeight: 600 }}>₹{fmt(Number(it.line_total))}</td>
                </tr>
              ))}

              {/* Totals row */}
              <tr style={{ background: "#fafbfc" }}>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: 13 }}>
                  Total
                </td>
                <td className="num muted">{c.items.length} line{c.items.length !== 1 ? "s" : ""}</td>
                <td className="num" style={{ fontWeight: 800, fontSize: 15 }}>{c.total_quantity}</td>
                <td className="num" style={{ fontWeight: 800, fontSize: 15 }}>₹{fmt(Number(c.total_amount))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
