import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authenticate, authorize } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(150),
  mobile: z.string().regex(/^[0-9+\-\s]{8,15}$/, "Mobile must be 8-15 digits"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  business_name: z.string().max(200).optional().nullable(),
  gst_number: z.string().max(20).optional().nullable().or(z.literal("")),
  customer_type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]).default("RETAIL"),
  address: z.string().optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("LEAD"),
  follow_up_date: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

const followUpSchema = z.object({
  note: z.string().min(1, "Note is required"),
  next_date: z.string().optional().nullable().or(z.literal("")),
});

function clean(v: any) { return v === "" ? null : v; }

/** GET /customers?search=&status=&type=&page=&limit=  (paginated) */
router.get("/", authorize("SALES", "ACCOUNTS", "WAREHOUSE"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${params.length} OR mobile LIKE $${params.length} OR LOWER(COALESCE(business_name,'')) LIKE $${params.length})`);
    }
    if (req.query.status) { params.push(req.query.status); conditions.push(`status = $${params.length}`); }
    if (req.query.type)   { params.push(req.query.type);   conditions.push(`customer_type = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const count = await pool.query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const data = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: data.rows,
      pagination: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / limit) },
    });
  } catch (e) { next(e); }
});

/** GET /customers/:id  (detail incl. follow-ups) */
router.get("/:id", authorize("SALES", "ACCOUNTS", "WAREHOUSE"), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!rows[0]) throw new HttpError(404, "Customer not found");
    const followUps = await pool.query(
      `SELECT f.*, u.name AS created_by_name
       FROM follow_ups f LEFT JOIN users u ON u.id = f.created_by
       WHERE f.customer_id = $1 ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], follow_ups: followUps.rows });
  } catch (e) { next(e); }
});

/** POST /customers */
router.post("/", authorize("SALES"), async (req, res, next) => {
  try {
    const c = customerSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [c.name, c.mobile, clean(c.email), clean(c.business_name), clean(c.gst_number), c.customer_type,
       clean(c.address), c.status, clean(c.follow_up_date), clean(c.notes), req.user!.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PUT /customers/:id */
router.put("/:id", authorize("SALES"), async (req, res, next) => {
  try {
    const c = customerSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE customers SET name=$1, mobile=$2, email=$3, business_name=$4, gst_number=$5, customer_type=$6,
       address=$7, status=$8, follow_up_date=$9, notes=$10, updated_at=now()
       WHERE id=$11 RETURNING *`,
      [c.name, c.mobile, clean(c.email), clean(c.business_name), clean(c.gst_number), c.customer_type,
       clean(c.address), c.status, clean(c.follow_up_date), clean(c.notes), req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, "Customer not found");
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /customers/:id/follow-ups */
router.post("/:id/follow-ups", authorize("SALES"), async (req, res, next) => {
  try {
    const f = followUpSchema.parse(req.body);
    const exists = await pool.query("SELECT id FROM customers WHERE id = $1", [req.params.id]);
    if (!exists.rows[0]) throw new HttpError(404, "Customer not found");
    const { rows } = await pool.query(
      `INSERT INTO follow_ups (customer_id, note, next_date, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, f.note, clean(f.next_date), req.user!.id]
    );
    if (clean(f.next_date)) {
      await pool.query("UPDATE customers SET follow_up_date = $1, updated_at = now() WHERE id = $2",
        [f.next_date, req.params.id]);
    }
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
