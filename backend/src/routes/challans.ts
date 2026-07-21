import { Router } from "express";
import { z } from "zod";
import { PoolClient } from "pg";
import { pool } from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const challanSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
      })
    )
    .min(1, "At least one product is required"),
});

/**
 * Reduces stock for every challan item inside the caller's transaction.
 * Locks product rows, rejects if any product would go negative (422),
 * and writes an OUT stock movement per item.
 */
async function reduceStockForChallan(
  client: PoolClient,
  challanId: number,
  challanNumber: string,
  userId: number
) {
  const items = await client.query(
    "SELECT product_id, product_name, quantity FROM challan_items WHERE challan_id = $1",
    [challanId]
  );
  for (const item of items.rows) {
    const prod = await client.query(
      "SELECT current_stock, name FROM products WHERE id = $1 FOR UPDATE",
      [item.product_id]
    );
    if (!prod.rows[0]) throw new HttpError(400, `Product ${item.product_name} no longer exists`);
    if (prod.rows[0].current_stock < item.quantity) {
      throw new HttpError(
        422,
        `Insufficient stock for "${prod.rows[0].name}": available ${prod.rows[0].current_stock}, requested ${item.quantity}`
      );
    }
    await client.query(
      "UPDATE products SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2",
      [item.quantity, item.product_id]
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
       VALUES ($1, $2, 'OUT', $3, $4)`,
      [item.product_id, item.quantity, `Challan ${challanNumber} confirmed`, userId]
    );
  }
}

/** Restores stock when a confirmed challan is cancelled. */
async function restoreStockForChallan(
  client: PoolClient,
  challanId: number,
  challanNumber: string,
  userId: number
) {
  const items = await client.query(
    "SELECT product_id, quantity FROM challan_items WHERE challan_id = $1",
    [challanId]
  );
  for (const item of items.rows) {
    await client.query(
      "UPDATE products SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2",
      [item.quantity, item.product_id]
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
       VALUES ($1, $2, 'IN', $3, $4)`,
      [item.product_id, item.quantity, `Challan ${challanNumber} cancelled`, userId]
    );
  }
}

/** GET /challans?status=&customer_id=&search=&page=&limit= */
router.get("/", authorize("SALES", "ACCOUNTS", "WAREHOUSE"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    if (req.query.status) { params.push(req.query.status); conditions.push(`c.status = $${params.length}`); }
    if (req.query.customer_id) { params.push(req.query.customer_id); conditions.push(`c.customer_id = $${params.length}`); }
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(`(LOWER(c.challan_number) LIKE $${params.length} OR LOWER(cu.name) LIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await pool.query(
      `SELECT COUNT(*) FROM challans c JOIN customers cu ON cu.id = c.customer_id ${where}`, params);
    const data = await pool.query(
      `SELECT c.*, cu.name AS customer_name, u.name AS created_by_name
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN users u ON u.id = c.created_by
       ${where} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: data.rows,
      pagination: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / limit) },
    });
  } catch (e) { next(e); }
});

/** GET /challans/:id  (with line items) */
router.get("/:id", authorize("SALES", "ACCOUNTS", "WAREHOUSE"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cu.name AS customer_name, u.name AS created_by_name
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, "Challan not found");
    const items = await pool.query(
      "SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY id", [req.params.id]);
    res.json({ ...rows[0], items: items.rows });
  } catch (e) { next(e); }
});

/**
 * POST /challans
 * Creates a challan as DRAFT or CONFIRMED.
 * - challan number is auto-generated: CH-<year>-<5-digit sequence>
 * - line items store a product snapshot (name, sku, unit_price)
 * - if CONFIRMED: stock is reduced atomically; insufficient stock -> 422, nothing saved
 */
router.post("/", authorize("SALES"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = challanSchema.parse(req.body);
    await client.query("BEGIN");

    const customer = await client.query("SELECT * FROM customers WHERE id = $1", [body.customer_id]);
    if (!customer.rows[0]) throw new HttpError(400, "Customer does not exist");

    // Auto-generate the challan number from a DB sequence (gap-free enough, always unique)
    const seq = await client.query("SELECT nextval('challan_number_seq') AS n");
    const challanNumber = `CH-${new Date().getFullYear()}-${String(seq.rows[0].n).padStart(5, "0")}`;

    const cu = customer.rows[0];
    const customerSnapshot = {
      name: cu.name, mobile: cu.mobile, business_name: cu.business_name,
      gst_number: cu.gst_number, address: cu.address, customer_type: cu.customer_type,
    };

    const created = await client.query(
      `INSERT INTO challans (challan_number, customer_id, customer_snapshot, status, created_by)
       VALUES ($1, $2, $3, 'DRAFT', $4) RETURNING *`,
      [challanNumber, body.customer_id, JSON.stringify(customerSnapshot), req.user!.id]
    );
    const challan = created.rows[0];

    // Merge duplicate product rows, then snapshot product data into line items
    const merged = new Map<number, number>();
    for (const it of body.items) merged.set(it.product_id, (merged.get(it.product_id) || 0) + it.quantity);

    let totalQty = 0;
    let totalAmount = 0;
    for (const [productId, qty] of merged) {
      const prod = await client.query(
        "SELECT id, name, sku, unit_price FROM products WHERE id = $1", [productId]);
      if (!prod.rows[0]) throw new HttpError(400, `Product id ${productId} does not exist`);
      const p = prod.rows[0];
      const lineTotal = Number(p.unit_price) * qty;
      totalQty += qty;
      totalAmount += lineTotal;
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, product_name, sku, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [challan.id, p.id, p.name, p.sku, p.unit_price, qty, lineTotal]
      );
    }
    await client.query(
      "UPDATE challans SET total_quantity = $1, total_amount = $2 WHERE id = $3",
      [totalQty, totalAmount, challan.id]
    );

    if (body.status === "CONFIRMED") {
      await reduceStockForChallan(client, challan.id, challanNumber, req.user!.id);
      await client.query("UPDATE challans SET status = 'CONFIRMED', updated_at = now() WHERE id = $1", [challan.id]);
    }

    await client.query("COMMIT");
    const result = await pool.query("SELECT * FROM challans WHERE id = $1", [challan.id]);
    const items = await pool.query("SELECT * FROM challan_items WHERE challan_id = $1", [challan.id]);
    res.status(201).json({ ...result.rows[0], items: items.rows });
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/** PATCH /challans/:id/confirm  (DRAFT -> CONFIRMED, reduces stock) */
router.patch("/:id/confirm", authorize("SALES"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM challans WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new HttpError(404, "Challan not found");
    if (rows[0].status !== "DRAFT") throw new HttpError(422, `Only DRAFT challans can be confirmed (current: ${rows[0].status})`);

    await reduceStockForChallan(client, rows[0].id, rows[0].challan_number, req.user!.id);
    const updated = await client.query(
      "UPDATE challans SET status = 'CONFIRMED', updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

/** PATCH /challans/:id/cancel  (CONFIRMED challans restore stock) */
router.patch("/:id/cancel", authorize("SALES"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM challans WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new HttpError(404, "Challan not found");
    if (rows[0].status === "CANCELLED") throw new HttpError(422, "Challan is already cancelled");

    if (rows[0].status === "CONFIRMED") {
      await restoreStockForChallan(client, rows[0].id, rows[0].challan_number, req.user!.id);
    }
    const updated = await client.query(
      "UPDATE challans SET status = 'CANCELLED', updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

export default router;
