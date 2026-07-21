# FlowStack — Operations Portal (ERP + CRM)

A small ERP/CRM system for a wholesale/distribution company. Internal employees (Admin, Sales, Warehouse, Accounts) manage customers, products, stock, and sales challans through role-based access.

**Stack:** Node.js · TypeScript · Express · PostgreSQL · React (Vite) · JWT auth

---

## 1. Architecture overview

```
┌─────────────────┐        REST + JWT         ┌──────────────────┐        SQL         ┌────────────┐
│  React frontend │  ───────────────────────► │  Express API     │  ───────────────►  │ PostgreSQL │
│  (Vite, TS)     │  Authorization: Bearer    │  (TypeScript)    │  pg pool + txns    │            │
└─────────────────┘                           └──────────────────┘                    └────────────┘
```

- **Backend** (`/backend`): Express + TypeScript. Zod validates every write. A central error handler converts validation errors, PG constraint violations, and business-rule errors into clean JSON with proper HTTP status codes (400 validation, 401 auth, 403 role, 404 not found, 409 duplicate, 422 business rule such as insufficient stock).
- **Auth**: JWT (`POST /auth/login` returns a token). `authenticate` middleware verifies it; `authorize(...roles)` gates each route. ADMIN passes every gate.
- **Stock integrity**: all stock changes (manual movements, challan confirm/cancel) run inside a PostgreSQL transaction with `SELECT ... FOR UPDATE` row locks, so stock can never go negative even under concurrent requests. A `CHECK (current_stock >= 0)` constraint is a second line of defence at the DB level.
- **Challans**: challan numbers are generated from a DB sequence (`CH-2026-00001`). Line items store a **snapshot** of product name, SKU, and unit price, and the challan stores a customer snapshot — so old challans stay correct even if products/customers change later.
- **Frontend** (`/frontend`): React + Vite + TypeScript, React Router, a small typed fetch wrapper, and one hand-written CSS file. The UI adapts to the signed-in role (e.g., only Sales sees "New challan", only Warehouse can record stock movements). Responsive down to mobile.

### Role permissions

| Module            | Admin | Sales | Warehouse | Accounts |
|-------------------|-------|-------|-----------|----------|
| Customers         | full  | full  | view      | view     |
| Products          | full  | view  | full      | view     |
| Stock movements   | full  | view  | full      | view     |
| Sales challans    | full  | full  | view      | view     |

---

## 2. Run locally

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+ (local install **or** Docker **or** a free Neon/Supabase database)

### Step 1 — Database

Option A, local Postgres:
```bash
createdb flowstack_db
```

Option B, Docker (Postgres only):
```bash
docker compose up db -d
```

Option C, free hosted DB: create a project on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy the connection string.

### Step 2 — Backend

```bash
cd backend
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
npm install
npm run db:schema           # creates tables (runs db/schema.sql via psql)
npm run db:seed             # creates test users + sample data
npm run dev                 # API on http://localhost:4000
```

> No `psql` installed? Paste the contents of `backend/db/schema.sql` into your DB provider's SQL editor (Neon/Supabase both have one), then run `npm run db:seed`.

### Step 3 — Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # UI on http://localhost:5173
```

### Test login credentials (created by the seed)

| Role      | Email               | Password       |
|-----------|---------------------|----------------|
| Admin     | admin@erp.com       | Admin@123      |
| Sales     | sales@erp.com       | Sales@123      |
| Warehouse | warehouse@erp.com   | Warehouse@123  |
| Accounts  | accounts@erp.com    | Accounts@123   |

---

## 3. Environment variables

### Backend (`backend/.env`)

| Variable         | Purpose                                                    |
|------------------|------------------------------------------------------------|
| `PORT`           | API port (default 4000)                                    |
| `DATABASE_URL`   | PostgreSQL connection string                               |
| `DATABASE_SSL`   | `true` for hosted DBs (Neon/Supabase/Render)               |
| `JWT_SECRET`     | Secret for signing tokens — use a long random string       |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `8h`                                  |
| `CORS_ORIGINS`   | Comma-separated allowed frontend origins                   |

### Frontend (`frontend/.env`)

| Variable       | Purpose                             |
|----------------|-------------------------------------|
| `VITE_API_URL` | Backend base URL (no trailing `/`)  |

Secrets are never committed — `.env` is gitignored; `.env.example` documents every variable.

---

## 4. Deployment (free tier)

### Database → Neon (or Supabase)
1. Create a project, copy the connection string.
2. Run `backend/db/schema.sql` in the SQL editor.
3. Locally, point `DATABASE_URL` at it (with `DATABASE_SSL=true`) and run `npm run db:seed` once.

### Backend → Render
1. New → Web Service → connect the GitHub repo, root directory `backend`.
2. Build command: `npm install && npm run build` — Start command: `npm start`.
3. Environment variables: `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `JWT_EXPIRES_IN=8h`, `CORS_ORIGINS=https://<your-frontend>.vercel.app`.
4. Deploy, then verify `https://<service>.onrender.com/health` returns `{"ok":true}`.

### Frontend → Vercel
1. Import the repo, set root directory to `frontend` (framework: Vite).
2. Environment variable: `VITE_API_URL=https://<service>.onrender.com`.
3. Deploy. Vercel serves the SPA; add a rewrite so client routes work on refresh — create `frontend/vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Optional: Docker
`docker compose up --build` starts Postgres + the backend. Run schema/seed once against `postgres://postgres:postgres@localhost:5432/erp_crm`, then start the frontend with `npm run dev`.

### Optional: AWS (bonus path)
The same containers run on AWS: push the backend image to ECR, run it on ECS Fargate or a t2.micro EC2 instance (Node 20 + PM2 + Nginx reverse proxy), use RDS PostgreSQL for the DB, and host the built frontend (`npm run build` → `dist/`) on S3 + CloudFront. Environment variables go in the ECS task definition or a `.env` on the instance.

---

## 5. API summary

All routes except `/auth/login` and `/health` require `Authorization: Bearer <token>`.

| Method | Route | Roles (write) | Notes |
|--------|-------|---------------|-------|
| POST | `/auth/login` | public | returns `{ token, user }` |
| GET  | `/auth/me` | any | current user |
| GET  | `/customers` | any | `?search=&status=&type=&page=&limit=` |
| GET  | `/customers/:id` | any | includes follow-up timeline |
| POST | `/customers` | Sales/Admin | Zod-validated |
| PUT  | `/customers/:id` | Sales/Admin | |
| POST | `/customers/:id/follow-ups` | Sales/Admin | updates next follow-up date |
| GET  | `/products` | any | `?search=&low_stock=true&page=&limit=` |
| POST | `/products` | Warehouse/Admin | opening stock creates an IN movement |
| PUT  | `/products/:id` | Warehouse/Admin | stock not editable here by design |
| GET  | `/stock-movements` | any | `?product_id=&page=&limit=` |
| POST | `/stock-movements` | Warehouse/Admin | OUT blocked if it would go negative (422) |
| GET  | `/challans` | any | `?status=&search=&customer_id=&page=&limit=` |
| GET  | `/challans/:id` | any | with snapshot line items |
| POST | `/challans` | Sales/Admin | DRAFT or CONFIRMED; confirm reduces stock atomically |
| PATCH | `/challans/:id/confirm` | Sales/Admin | DRAFT → CONFIRMED |
| PATCH | `/challans/:id/cancel` | Sales/Admin | restores stock if it was confirmed |

Import `postman_collection.json` into Postman — the login request auto-saves the token for all other requests, and it includes ready-made error-case requests (validation 400, insufficient stock 422).

---

## 6. Assumptions made

- One warehouse per product (location is a text field), matching the "not a huge system" brief.
- Invoices are out of scope; challans carry totals so an invoice module could be added on top.
- Product stock can only change through stock movements (opening stock, manual IN/OUT, challan confirm/cancel) so the movement log is always the complete audit trail.
- Customers and challans are visible to all roles (read-only for Warehouse/Accounts) because warehouse staff need customer/challan context to dispatch goods.
- Users are created via the seed script; a user-management admin UI was considered out of scope.
- Currency is INR (₹) and GST number is stored as an optional free-text field without checksum validation.

## 7. Known limitations / incomplete parts

- No refresh tokens — the JWT expires after 8h and the user signs in again.
- No automated tests; the Postman collection covers the main and error flows manually.
- Draft challans cannot be edited after creation (only confirmed or cancelled).
- No PDF export / S3 image upload / GitHub Actions (listed as bonus items; the Docker setup is included).
- Pagination is offset-based, which is fine at this scale but would move to keyset pagination for large tables.

---

## 8. Submission checklist mapping

1. GitHub repository — push this folder as the repo root (backend/, frontend/, README, postman_collection.json).
2. Live frontend URL — Vercel (section 4).
3. Live backend URL — Render `/health` endpoint (section 4).
4. Test credentials for all roles — section 2.
5. Postman collection — `postman_collection.json` in the repo root.
6. Setup + deployment instructions — sections 2–4.
7. Architecture explanation — section 1.
8. Known limitations — section 7.
