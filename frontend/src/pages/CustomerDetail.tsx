import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get(`/customers/${id}`).then(setC).catch(() => setError("Customer not found."));
  useEffect(() => { load(); }, [id]);

  const addFollowUp = async () => {
    if (!note.trim()) { setNoteError("Note cannot be empty."); return; }
    setNoteError(""); setError("");
    setSubmitting(true);
    try {
      await api.post(`/customers/${id}/follow-ups`, {
        note: note.trim(),
        next_date: nextDate || undefined,
      });
      setNote(""); setNextDate("");
      load();
    } catch (e) {
      setNoteError(e instanceof ApiError ? e.message : "Could not add follow-up");
    } finally {
      setSubmitting(false);
    }
  };

  if (!c && !error) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px" }}>
        <p className="muted">Loading customer…</p>
      </div>
    );
  }

  if (error && !c) {
    return (
      <div>
        <div className="alert error">{error}</div>
        <button className="btn ghost" onClick={() => navigate("/customers")}>← Back to customers</button>
      </div>
    );
  }

  const statusBadge: Record<string, string> = { ACTIVE: "green", LEAD: "blue", INACTIVE: "grey" };

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button
              className="btn ghost sm"
              onClick={() => navigate("/customers")}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ← Customers
            </button>
          </div>
          <h2>{c.name}</h2>
          <div className="sub">{c.business_name || "Individual customer"}</div>
        </div>
        <div className="actions">
          <span className={`badge ${statusBadge[c.status] || "grey"}`}>{c.status}</span>
          {can("SALES") && (
            <Link
              className="btn ghost"
              to={`/customers/${id}/edit`}
              id="customer-edit-btn"
            >
              Edit customer
            </Link>
          )}
          {can("SALES") && (
            <Link
              className="btn primary"
              to={`/challans/new`}
              id="customer-new-challan"
            >
              + New challan
            </Link>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="card">
        <div className="card-title">
          <div className="ct-icon">👤</div>
          Customer details
        </div>
        <div className="detail-grid">
          <div className="item">
            <div className="k">Mobile</div>
            <div className="v mono">{c.mobile}</div>
          </div>
          <div className="item">
            <div className="k">Email</div>
            <div className="v">{c.email || "—"}</div>
          </div>
          <div className="item">
            <div className="k">GST number</div>
            <div className="v mono">{c.gst_number || "—"}</div>
          </div>
          <div className="item">
            <div className="k">Customer type</div>
            <div className="v">
              <span className="badge grey">{c.customer_type}</span>
            </div>
          </div>
          <div className="item">
            <div className="k">Status</div>
            <div className="v">
              <span className={`badge ${statusBadge[c.status] || "grey"}`}>{c.status}</span>
            </div>
          </div>
          <div className="item">
            <div className="k">Next follow-up</div>
            <div className="v">
              {c.follow_up_date ? (
                <span style={{
                  color: new Date(c.follow_up_date) < new Date() ? "var(--red)" : undefined,
                  fontWeight: new Date(c.follow_up_date) < new Date() ? 600 : undefined,
                }}>
                  {c.follow_up_date.slice(0, 10)}
                  {new Date(c.follow_up_date) < new Date() && " ⚠ Overdue"}
                </span>
              ) : "—"}
            </div>
          </div>
          {c.address && (
            <div className="item" style={{ gridColumn: "span 2" }}>
              <div className="k">Address</div>
              <div className="v">{c.address}</div>
            </div>
          )}
          {c.notes && (
            <div className="item" style={{ gridColumn: "span 2" }}>
              <div className="k">Notes</div>
              <div className="v" style={{ color: "var(--muted)", fontSize: 13.5 }}>{c.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Follow-ups */}
      <div className="card">
        <div className="card-title">
          <div className="ct-icon">📋</div>
          Follow-up timeline
          <span className="chip" style={{ marginLeft: "auto" }}>
            {c.follow_ups?.length || 0} entries
          </span>
        </div>

        {can("SALES") && (
          <>
            {noteError && <div className="alert error">{noteError}</div>}
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <label className="field span-2">
                New follow-up note <span className="req">*</span>
                <input
                  id="followup-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Called customer, will confirm order next week…"
                  onKeyDown={(e) => e.key === "Enter" && addFollowUp()}
                />
              </label>
              <label className="field">
                Next follow-up date
                <input
                  id="followup-date"
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button
                  id="followup-submit"
                  className="btn primary"
                  onClick={addFollowUp}
                  disabled={!note.trim() || submitting}
                >
                  {submitting ? "Adding…" : "+ Add follow-up"}
                </button>
              </div>
            </div>
            <div className="divider" />
          </>
        )}

        <ul className="timeline">
          {c.follow_ups?.length === 0 && (
            <li style={{ border: "none", paddingBottom: 0 }}>
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <div className="empty-icon">📋</div>
                <p>No follow-ups recorded yet</p>
                <small>Add the first follow-up note above.</small>
              </div>
            </li>
          )}
          {c.follow_ups?.map((f: any) => (
            <li key={f.id}>
              <div className="tl-dot" />
              <div className="tl-body">
                <div className="tl-note">{f.note}</div>
                <div className="meta">
                  <span>{new Date(f.created_at).toLocaleString()}</span>
                  {f.created_by_name && <span>by {f.created_by_name}</span>}
                  {f.next_date && (
                    <span className="next-date">
                      next: {f.next_date.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
