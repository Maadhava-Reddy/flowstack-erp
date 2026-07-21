/**
 * Seeds one user per role plus sample customers and products.
 * Run after schema.sql:  npm run db:seed
 * Safe to re-run: uses ON CONFLICT DO NOTHING.
 */
import bcrypt from "bcryptjs";
import { pool } from "./db";

async function main() {
  const users = [
    { name: "Admin User", email: "admin@erp.com", password: "Admin@123", role: "ADMIN" },
    { name: "Sales User", email: "sales@erp.com", password: "Sales@123", role: "SALES" },
    { name: "Warehouse User", email: "warehouse@erp.com", password: "Warehouse@123", role: "WAREHOUSE" },
    { name: "Accounts User", email: "accounts@erp.com", password: "Accounts@123", role: "ACCOUNTS" },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }

  await pool.query(
    `INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, notes)
     VALUES
     ('Ramesh Traders', '9876543210', 'ramesh@traders.in', 'Ramesh Trading Co', '27AAAPL1234C1ZV', 'WHOLESALE', 'Nashik, Maharashtra', 'ACTIVE', 'Buys monthly'),
     ('Priya Retail Mart', '9812345678', 'priya@mart.in', 'Priya Mart', NULL, 'RETAIL', 'Pune, Maharashtra', 'LEAD', 'Asked for price list'),
     ('Metro Distributors', '9900112233', 'ops@metrodist.in', 'Metro Distributors Pvt Ltd', '29AABCM9910D1Z2', 'DISTRIBUTOR', 'Bengaluru, Karnataka', 'ACTIVE', 'Key account')
     ON CONFLICT DO NOTHING`
  );

  await pool.query(
    `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock, location)
     VALUES
     ('Basmati Rice 25kg', 'RICE-25', 'Grains', 2150.00, 120, 20, 'WH-A / Rack 1'),
     ('Sunflower Oil 15L', 'OIL-15', 'Oils', 1890.00, 60, 15, 'WH-A / Rack 3'),
     ('Wheat Flour 50kg', 'FLR-50', 'Flour', 1650.00, 8, 10, 'WH-B / Rack 2'),
     ('Sugar 50kg', 'SUG-50', 'Sugar', 2050.00, 45, 10, 'WH-B / Rack 4')
     ON CONFLICT (sku) DO NOTHING`
  );

  console.log("Seed complete.");
  console.log("Logins: admin@erp.com/Admin@123, sales@erp.com/Sales@123, warehouse@erp.com/Warehouse@123, accounts@erp.com/Accounts@123");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
