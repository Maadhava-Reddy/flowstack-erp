import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";

const empty = {
  name: "",
  sku: "",
  category: "",
  unit_price: "",
  current_stock: "0",
  min_stock: "5",
  location: "",
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<any>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then((p) =>
        setForm({
          ...p,
          category: p.category || "",
          location: p.location || "",
          unit_price: String(p.unit_price),
          current_stock: String(p.current_stock),
          min_stock: String(p.min_stock),
        })
      );
    }
  }, [id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const save = async () => {
    setGlobalError(""); setErrors({}); setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        sku: form.sku,
        category: form.category || undefined,
        unit_price: form.unit_price,
        min_stock: form.min_stock,
        location: form.location || undefined,
      };
      if (id) {
        await api.put(`/products/${id}`, payload);
      } else {
        await api.post("/products", { ...payload, current_stock: form.current_stock });
      }
      navigate("/products");
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        const fieldErrors: Record<string, string> = {};
        e.details.forEach((d) => { fieldErrors[d.field] = d.message; });
        setErrors(fieldErrors);
      } else {
        setGlobalError(e instanceof ApiError ? e.message : "Could not save product. Please try again.");
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
              onClick={() => navigate("/products")}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ← Products
            </button>
          </div>
          <h2>{isEdit ? "Edit product" : "Add new product"}</h2>
          <div className="sub">{isEdit ? "Update product details" : "Add a new item to the catalogue"}</div>
        </div>
      </div>

      {globalError && <div className="alert error">{globalError}</div>}

      <div className="card">
        <div className="form-section-title">Product details</div>
        <div className="form-grid">
          <label className="field">
            Product name <span className="req">*</span>
            <input
              id="product-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Basmati Rice 25kg"
              style={errors.name ? { borderColor: "var(--red)" } : undefined}
            />
            {errors.name && <span style={{ color: "var(--red)", fontSize: 11.5 }}>{errors.name}</span>}
          </label>

          <label className="field">
            SKU / item code <span className="req">*</span>
            <input
              id="product-sku"
              value={form.sku}
              onChange={set("sku")}
              placeholder="RICE-25KG"
              style={{ fontFamily: "var(--mono)", fontSize: 13, ...(errors.sku ? { borderColor: "var(--red)" } : {}) }}
            />
            {errors.sku && <span style={{ color: "var(--red)", fontSize: 11.5 }}>{errors.sku}</span>}
          </label>

          <label className="field">
            Category
            <input
              id="product-category"
              value={form.category}
              onChange={set("category")}
              placeholder="Grains, Spices, Oils…"
            />
          </label>

          <label className="field">
            Unit price (₹) <span className="req">*</span>
            <input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={set("unit_price")}
              placeholder="0.00"
              style={errors.unit_price ? { borderColor: "var(--red)" } : undefined}
            />
            {errors.unit_price && <span style={{ color: "var(--red)", fontSize: 11.5 }}>{errors.unit_price}</span>}
          </label>
        </div>

        <div className="divider" />
        <div className="form-section-title">Stock settings</div>
        <div className="form-grid">
          {!isEdit && (
            <label className="field">
              Opening stock qty
              <input
                id="product-opening-stock"
                type="number"
                min="0"
                value={form.current_stock}
                onChange={set("current_stock")}
                placeholder="0"
              />
            </label>
          )}

          <label className="field">
            Minimum stock alert qty
            <input
              id="product-min-stock"
              type="number"
              min="0"
              value={form.min_stock}
              onChange={set("min_stock")}
              placeholder="5"
            />
            <span style={{ color: "var(--muted)", fontSize: 11 }}>
              Dashboard will alert when stock falls below this
            </span>
          </label>

          <label className="field">
            Location / warehouse bin
            <input
              id="product-location"
              value={form.location}
              onChange={set("location")}
              placeholder="WH-A / Rack 1 / Bin 3"
            />
          </label>
        </div>

        {isEdit && (
          <div className="alert info" style={{ marginTop: 14 }}>
            Stock quantity is adjusted through stock movements — not by editing the product directly.
            <Link to="/stock" style={{ marginLeft: 8, fontWeight: 600 }}>Go to stock movements →</Link>
          </div>
        )}

        <div className="form-actions">
          <button
            id="product-save-btn"
            className="btn primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Update product" : "Add to catalogue"}
          </button>
          <button className="btn ghost" onClick={() => navigate("/products")}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
