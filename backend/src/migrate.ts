import fs from "fs";
import path from "path";
import { pool } from "./db";

async function migrate() {
  console.log("Running database migrations from db/schema.sql...");
  try {
    const schemaPath = path.join(__dirname, "../db/schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf-8");
    await pool.query(sql);
    console.log("✓ Database schema migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
