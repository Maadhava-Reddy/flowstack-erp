import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const movementSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
  movement_type: z.enum(["IN", "OUT"]),
  reason: z.string().min(2, "Reason is required").max(200),
});

/** GET /stock-movements?product_id=&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let where = "";
    if (req.query.product_id) {
      params.push(req.query.product_id);
      where = `WHERE m.product_id = $${params.length}`;
    }
    const count = await pool.query(`SELECT COUNT(*) FROM stock_movements m ${where}`, params);
    const data = await pool.query(
      `SELECT m.*, p.name AS product_name, p.sku, u.name AS created_by_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
       ${where} ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: data.rows,
      pagination: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / limit) },
    });
  } catch (e) { next(e); }
});

/** POST /stock-movements  (manual IN/OUT; OUT cannot push stock negative) */
router.post("/", authorize("WAREHOUSE"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const m = movementSchema.parse(req.body);
    await client.query("BEGIN");
    const prod = await client.query("SELECT id, current_stock FROM products WHERE id = $1 FOR UPDATE", [m.product_id]);
    if (!prod.rows[0]) throw new HttpError(404, "Product not found");

    if (m.movement_type === "OUT" && prod.rows[0].current_stock < m.quantity) {
      throw new HttpError(422, `Insufficient stock: available ${prod.rows[0].current_stock}, requested ${m.quantity}`);
    }
    const delta = m.movement_type === "IN" ? m.quantity : -m.quantity;
    await client.query("UPDATE products SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2",
      [delta, m.product_id]);
    const { rows } = await client.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [m.product_id, m.quantity, m.movement_type, m.reason, req.user!.id]
    );
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

export default router;
