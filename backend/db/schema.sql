-- Mini ERP + CRM schema (PostgreSQL)
-- Run once: psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN','SALES','WAREHOUSE','ACCOUNTS')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  mobile         VARCHAR(20)  NOT NULL,
  email          VARCHAR(150),
  business_name  VARCHAR(200),
  gst_number     VARCHAR(20),
  customer_type  VARCHAR(20) NOT NULL DEFAULT 'RETAIL'
                 CHECK (customer_type IN ('RETAIL','WHOLESALE','DISTRIBUTOR')),
  address        TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'LEAD'
                 CHECK (status IN ('LEAD','ACTIVE','INACTIVE')),
  follow_up_date DATE,
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_name   ON customers (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);

-- CRM follow-up notes (timeline on the customer detail page)
CREATE TABLE IF NOT EXISTS follow_ups (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note         TEXT NOT NULL,
  next_date    DATE,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_customer ON follow_ups (customer_id);

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  sku            VARCHAR(50)  NOT NULL UNIQUE,
  category       VARCHAR(100),
  unit_price     NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  current_stock  INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock      INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  location       VARCHAR(100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (LOWER(name));

CREATE TABLE IF NOT EXISTS stock_movements (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  movement_type VARCHAR(3) NOT NULL CHECK (movement_type IN ('IN','OUT')),
  reason        VARCHAR(200) NOT NULL,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id);

-- Challan numbers: CH-2026-00001 generated from this sequence
CREATE SEQUENCE IF NOT EXISTS challan_number_seq START 1;

CREATE TABLE IF NOT EXISTS challans (
  id             SERIAL PRIMARY KEY,
  challan_number VARCHAR(30) NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  -- snapshot of the customer at creation time
  customer_snapshot JSONB NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challans_customer ON challans (customer_id);
CREATE INDEX IF NOT EXISTS idx_challans_status   ON challans (status);

-- Line items store a product snapshot (name/sku/price), not only product_id
CREATE TABLE IF NOT EXISTS challan_items (
  id            SERIAL PRIMARY KEY,
  challan_id    INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  product_name  VARCHAR(200) NOT NULL,
  sku           VARCHAR(50) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    NUMERIC(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items (challan_id);

COMMIT;
