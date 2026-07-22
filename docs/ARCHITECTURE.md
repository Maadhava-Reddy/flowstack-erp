# System Architecture & Design

This document details the architectural design, folder structure, database schema, and transaction boundaries of the **FlowStack ERP + CRM Operations Portal**.

---

## 1. System Design Overview

The application follows a standard decoupled **Single Page Application (SPA)** and **RESTful API** architecture:

```mermaid
graph TD
    Client[React Frontend SPA - Vercel]
    API[Express TypeScript API - Railway]
    DB[(PostgreSQL DB - Supabase)]
    
    Client -- HTTP JSON Requests / JWT Auth --> API
    API -- pg driver / SQL Queries --> DB
```

- **Frontend**: A client-side React app bundled via Vite. It uses **React Router DOM** for routing and a lightweight custom fetch wrapper to communicate with the backend. User state is persisted in `localStorage`.
- **Backend**: A Node.js + Express REST API written in TypeScript. Route handlers use **Zod** to validate request bodies, and the raw **`pg` (node-postgres)** driver executes queries against PostgreSQL.
- **Database**: PostgreSQL hosted on Supabase. Relational integrity is enforced using foreign keys and unique constraints at the database level.

---

## 2. Directory Layout

The workspace is organized as a monorepo structure:

```text
flowstack/
├── backend/                  # Node.js + Express API
│   ├── db/                   # Database schemas and scripts
│   │   ├── schema.sql        # DB tables and indexes definition
│   │   ├── seed.ts           # Demo users and sample data seed script
│   │   └── migrate.ts        # Script to run schema.sql programmatically
│   └── src/
│       ├── middleware/       # JWT verification & error handling
│       ├── routes/           # REST endpoints (auth, customers, products, stock, challans)
│       ├── db.ts             # PostgreSQL pool initialization
│       └── index.ts          # Server entry point & CORS configuration
├── frontend/                 # React SPA (Vite)
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # View components mapping to routes
│   │   ├── api.ts            # Fetch wrapper and API communication logic
│   │   ├── auth.tsx          # Authentication context provider
│   │   ├── App.tsx           # React UI routing
│   │   ├── main.tsx          # React DOM mounting
│   │   └── styles.css        # Premium dark UI styling and CSS variables
│   └── index.html            # Vite HTML entry point
├── docs/                     # Documentation files
│   ├── API.md                # REST endpoint specifications
│   └── ARCHITECTURE.md       # This file
└── docker-compose.yml        # Local development orchestration
```

---

## 3. Database Schema

The database consists of 6 primary tables: `users`, `customers`, `follow_ups`, `products`, `stock_movements`, `challans`, and `challan_items`.

```mermaid
erDiagram
    users {
        int id PK
        varchar name
        varchar email UK
        varchar role "ADMIN, SALES, WAREHOUSE, ACCOUNTS"
    }
    
    customers {
        int id PK
        varchar name
        varchar mobile
        varchar email
        varchar business_name
        varchar customer_type
        varchar status
        date follow_up_date
        int created_by FK "-> users.id"
    }
    
    follow_ups {
        int id PK
        int customer_id FK "-> customers.id"
        text note
        date next_date
        int created_by FK "-> users.id"
    }

    products {
        int id PK
        varchar name
        varchar sku UK
        decimal unit_price
        int current_stock
        int min_stock
    }

    stock_movements {
        int id PK
        int product_id FK "-> products.id"
        int quantity
        varchar movement_type "IN, OUT"
        varchar reason
        int created_by FK "-> users.id"
    }

    challans {
        int id PK
        varchar challan_number UK
        int customer_id FK "-> customers.id"
        jsonb customer_snapshot
        varchar status "DRAFT, CONFIRMED, CANCELLED"
        int total_quantity
        decimal total_amount
        int created_by FK "-> users.id"
    }
    
    challan_items {
        int id PK
        int challan_id FK "-> challans.id"
        int product_id FK "-> products.id"
        varchar product_name
        varchar sku
        decimal unit_price
        int quantity
        decimal line_total
    }

    users ||--o{ customers : creates
    customers ||--o{ follow_ups : has
    users ||--o{ follow_ups : creates
    products ||--o{ stock_movements : logs
    users ||--o{ stock_movements : creates
    customers ||--o{ challans : receives
    users ||--o{ challans : creates
    challans ||--|{ challan_items : contains
    products ||--o{ challan_items : references
```

### Snapshotting Pattern
When a `challan` is created, it captures the customer's details into the `customer_snapshot` column and the product details (name, sku, unit_price) into `challan_items`. This ensures that historical sales orders remain accurate even if the product price or customer details are changed later.

---

## 4. Concurrency & Transaction Management

Since multiple users (Sales, Warehouse) interact with the same product inventory concurrently, strict transaction boundaries and row-level locks are used to prevent race conditions.

### Stock Reductions (Challan Confirmation)
When a Sales rep confirms a challan:
1. `BEGIN` transaction.
2. `SELECT ... FROM products WHERE id = X FOR UPDATE` is executed for each item. This locks the product rows so no other process can modify the stock concurrently.
3. The system checks if `current_stock >= requested_quantity`.
    - If false, the transaction is `ROLLBACK`ed and a `422 Unprocessable Entity` is returned.
4. `UPDATE products SET current_stock = current_stock - quantity`.
5. `INSERT INTO stock_movements` (OUT).
6. `UPDATE challans SET status = 'CONFIRMED'`.
7. `COMMIT` transaction.

This pattern ensures that stock can never accidentally drop below zero due to concurrent sales.
