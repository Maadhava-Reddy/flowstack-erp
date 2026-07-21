import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  sku: z.string().min(2, "SKU is required").max(50),
  category: z.string().max(100).optional().nullable().or(z.literal("")),
  unit_price: z.coerce.number().nonnegative("Price cannot be negative"),
  current_stock: z.coerce.number().int().nonnegative().default(0),
  min_stock: z.coerce.number().int().nonnegative().default(0),
  location: z.string().max(100).optional().nullable().or(z.literal("")),
});

function clean(v: any) { return v === "" ? null : v; }

/** GET /products?search=&low_stock=true&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length} OR LOWER(COALESCE(category,'')) LIKE $${params.length})`);
    }
    if (req.query.low_stock === "true") conditions.push("current_stock <= min_stock");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params);
    const data = await pool.query(
      `SELECT * FROM products ${where} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: data.rows,
      pagination: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / limit) },
    });
  } catch (e) { next(e); }
});

/** GET /products/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) throw new HttpError(404, "Product not found");
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /products  (initial stock creates an IN movement) */
router.post("/", authorize("WAREHOUSE"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const p = productSchema.parse(req.body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [p.name, p.sku, clean(p.category), p.unit_price, p.current_stock, p.min_stock, clean(p.location)]
    );
    if (p.current_stock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
         VALUES ($1,$2,'IN','Opening stock',$3)`,
        [rows[0].id, p.current_stock, req.user!.id]
      );
    }
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/** PUT /products/:id  (stock is NOT edited here - use stock movements) */
router.put("/:id", authorize("WAREHOUSE"), async (req, res, next) => {
  try {
    const p = productSchema.omit({ current_stock: true }).parse(req.body);
    const { rows } = await pool.query(
      `UPDATE products SET name=$1, sku=$2, category=$3, unit_price=$4, min_stock=$5, location=$6, updated_at=now()
       WHERE id=$7 RETURNING *`,
      [p.name, p.sku, clean(p.category), p.unit_price, p.min_stock, clean(p.location), req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, "Product not found");
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
