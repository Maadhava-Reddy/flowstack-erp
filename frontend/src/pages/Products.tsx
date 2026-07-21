import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Products() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(params.get("low") === "1");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "12" });
      if (search) q.set("search", search);
      if (lowOnly) q.set("low_stock", "true");
      const res = await api.get(`/products?${q}`);
      setRows(res.data);
      setPages(res.pagination.pages || 1);
      setTotal(res.pagination.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search, lowOnly, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Products</h2>
          <div className="sub">{total} item{total !== 1 ? "s" : ""} in catalogue</div>
        </div>
        <div className="actions">
          {can("WAREHOUSE") && (
            <Link to="/products/new" className="btn primary" id="products-add-btn">
              + Add product
            </Link>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          id="products-search"
          placeholder="Search name, SKU, category…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <label className="checkbox-label">
          <input
            id="products-low-stock"
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }}
          />
          Low stock only
        </label>
      </div>

      {lowOnly && !loading && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          Showing {total} product{total !== 1 ? "s" : ""} below minimum stock threshold.
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="num">Unit price</th>
              <th className="num">Stock</th>
              <th className="num">Min</th>
              <th>Location</th>
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
                    <div className="empty-icon">📦</div>
                    <p>{lowOnly ? "No low-stock products found" : "No products found"}</p>
                    <small>
                      {lowOnly
                        ? "All products are above minimum stock levels."
                        : can("WAREHOUSE")
                        ? "Add your first product to build the catalogue."
                        : "No products in catalogue yet."}
                    </small>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((p) => {
                const isLow = p.current_stock <= p.min_stock;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="mono">{p.sku}</td>
                    <td className="muted">{p.category || "—"}</td>
                    <td className="num">₹{Number(p.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className={`num${isLow ? " low-stock" : ""}`} style={{ fontWeight: isLow ? 700 : undefined }}>
                      {p.current_stock}
                      {isLow && <span title="Below minimum" style={{ marginLeft: 5 }}>⚠</span>}
                    </td>
                    <td className="num muted">{p.min_stock}</td>
                    <td className="muted">{p.location || "—"}</td>
                    <td>
                      {can("WAREHOUSE") && (
                        <Link
                          className="btn ghost sm"
                          to={`/products/${p.id}/edit`}
                          id={`product-edit-${p.id}`}
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          id="products-prev"
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
          id="products-next"
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
