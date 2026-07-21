import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";

const empty = {
  name: "",
  mobile: "",
  email: "",
  business_name: "",
  gst_number: "",
  customer_type: "RETAIL",
  address: "",
  status: "LEAD",
  follow_up_date: "",
  notes: "",
};

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<any>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/customers/${id}`).then((c) =>
        setForm({
          ...c,
          email: c.email || "",
          business_name: c.business_name || "",
          gst_number: c.gst_number || "",
          address: c.address || "",
          notes: c.notes || "",
          follow_up_date: c.follow_up_date ? c.follow_up_date.slice(0, 10) : "",
        })
      );
    }
  }, [id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const save = async () => {
    setGlobalError(""); setErrors({}); setSaving(true);
    try {
      const payload = { ...form };
      delete payload.follow_ups;
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.created_by;
      if (!payload.follow_up_date) delete payload.follow_up_date;

      if (id) await api.put(`/customers/${id}`, payload);
      else await api.post("/customers", payload);
      navigate("/customers");
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        const fieldErrors: Record<string, string> = {};
        e.details.forEach((d) => { fieldErrors[d.field] = d.message; });
        setErrors(fieldErrors);
      } else {
        setGlobalError(e instanceof ApiError ? e.message : "Could not save customer. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <button
              className="btn ghost sm"
              onClick={() => navigate("/customers")}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ← Customers
            </button>
          </div>
          <h2>{isEdit ? "Edit customer" : "Add new customer"}</h2>
          <div className="sub">{isEdit ? "Update customer information" : "Create a new CRM record"}</div>
        </div>
      </div>

      {globalError && <div className="alert error">{globalError}</div>}

      <div className="card">
        <div className="form-section-title">Contact information</div>
        <div className="form-grid">
          <label className="field">
            Customer name <span className="req">*</span>
            <input
              id="customer-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Ramesh Traders"
              style={errors.name ? { borderColor: "var(--red)" } : undefined}
            />
            {errors.name && <span style={{ color: "var(--red)", fontSize: 11.5 }}>{errors.name}</span>}
          </label>

          <label className="field">
            Mobile number <span className="req">*</span>
            <input
              id="customer-mobile"
              value={form.mobile}
              onChange={set("mobile")}
              placeholder="9876543210"
              style={errors.mobile ? { borderColor: "var(--red)" } : undefined}
            />
            {errors.mobile && <span style={{ color: "var(--red)", fontSize: 11.5 }}>{errors.mobile}</span>}
          </label>

          <label className="field">
            Email address
            <input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="name@business.com"
            />
          </label>

          <label className="field">
            Business name
            <input
              id="customer-business"
              value={form.business_name}
              onChange={set("business_name")}
              placeholder="Ramesh Traders Pvt Ltd"
            />
          </label>

          <label className="field">
            GST number
            <input
              id="customer-gst"
              value={form.gst_number}
              onChange={set("gst_number")}
              placeholder="27AAAPL1234C1ZV"
              style={{ fontFamily: "var(--mono)", fontSize: 13 }}
            />
          </label>
        </div>

        <div className="divider" />
        <div className="form-section-title">Classification &amp; status</div>
        <div className="form-grid">
          <label className="field">
            Customer type
            <select id="customer-type" value={form.customer_type} onChange={set("customer_type")}>
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </label>

          <label className="field">
            Status
            <select id="customer-status" value={form.status} onChange={set("status")}>
              <option value="LEAD">Lead</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <label className="field">
            Next follow-up date
            <input
              id="customer-followup"
              type="date"
              value={form.follow_up_date}
              onChange={set("follow_up_date")}
            />
          </label>
        </div>

        <div className="divider" />
        <div className="form-section-title">Additional details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="field">
            Address
            <textarea
              id="customer-address"
              value={form.address}
              onChange={set("address")}
              placeholder="123, Main Street, Mumbai - 400001"
            />
          </label>

          <label className="field">
            Internal notes
            <textarea
              id="customer-notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Any internal notes about this customer…"
            />
          </label>
        </div>

        <div className="form-actions">
          <button
            id="customer-save-btn"
            className="btn primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Update customer" : "Add customer"}
          </button>
          <button
            className="btn ghost"
            onClick={() => navigate(id ? `/customers/${id}` : "/customers")}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
