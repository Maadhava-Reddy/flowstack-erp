# FlowStack ERP — API Documentation

The backend API is a RESTful JSON service. All request and response bodies use `Content-Type: application/json`.

- **Local Development**: `http://localhost:4000`
- **Production**: `https://flowstack-erp-production.up.railway.app`
- **Health Check**: `GET /health` → `{ "ok": true, "service": "flowstack-api" }`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Auth Endpoints](#2-auth-endpoints)
3. [Customer Endpoints](#3-customer-endpoints)
4. [Product Endpoints](#4-product-endpoints)
5. [Stock Movement Endpoints](#5-stock-movement-endpoints)
6. [Challan Endpoints](#6-challan-endpoints)
7. [Role Permissions Matrix](#7-role-permissions-matrix)
8. [Error Reference](#8-error-reference)

---

## 1. Authentication

All routes **except** `POST /auth/login` require a valid Bearer JWT in the `Authorization` header:

```http
Authorization: Bearer <your-jwt-token>
```

Tokens expire after **8 hours**. After expiry, the user must log in again.

---

## 2. Auth Endpoints

### POST `/auth/login`
Authenticates a user and returns a JWT token.

- **Auth required**: No
- **Request Body**:
```json
{
  "email": "admin@erp.com",
  "password": "Admin@123"
}
```
- **Success Response** `200 OK`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@erp.com",
    "role": "ADMIN"
  }
}
```
- **Error Response** `401 Unauthorized`:
```json
{ "error": "Invalid email or password" }
```

---

### GET `/auth/me`
Returns the currently authenticated user's profile from the JWT token.

- **Auth required**: Yes (any role)
- **Success Response** `200 OK`:
```json
{
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@erp.com",
    "role": "ADMIN"
  }
}
```

---

## 3. Customer Endpoints

### GET `/customers`
Returns a paginated list of customers with optional filters.

- **Auth required**: Yes — `ADMIN`, `SALES`, `ACCOUNTS`, `WAREHOUSE`
- **Query Parameters**:

| Parameter | Type   | Description |
| :-------- | :----- | :---------- |
| `search`  | string | Filters by name, mobile, or business name (case-insensitive) |
| `status`  | string | `LEAD` \| `ACTIVE` \| `INACTIVE` |
| `type`    | string | `RETAIL` \| `WHOLESALE` \| `DISTRIBUTOR` |
| `page`    | number | Page number (default: `1`) |
| `limit`   | number | Records per page (default: `10`, max: `100`) |

- **Success Response** `200 OK`:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Ravi Kumar",
      "mobile": "9876543210",
      "email": "ravi@example.com",
      "business_name": "Kumar Traders",
      "gst_number": "29ABCDE1234F1Z5",
      "customer_type": "WHOLESALE",
      "address": "Bengaluru",
      "status": "ACTIVE",
      "follow_up_date": "2026-08-01",
      "notes": "Key account",
      "created_by": 2,
      "created_at": "2026-07-01T10:00:00Z",
      "updated_at": "2026-07-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

---

### GET `/customers/:id`
Returns a single customer including their full follow-up timeline.

- **Auth required**: Yes — `ADMIN`, `SALES`, `ACCOUNTS`, `WAREHOUSE`
- **Success Response** `200 OK`:
```json
{
  "id": 1,
  "name": "Ravi Kumar",
  "mobile": "9876543210",
  "email": "ravi@example.com",
  "business_name": "Kumar Traders",
  "gst_number": "29ABCDE1234F1Z5",
  "customer_type": "WHOLESALE",
  "address": "Bengaluru",
  "status": "ACTIVE",
  "follow_up_date": "2026-08-01",
  "notes": "Key account",
  "created_at": "2026-07-01T10:00:00Z",
  "follow_ups": [
    {
      "id": 3,
      "customer_id": 1,
      "note": "Called, interested in bulk order",
      "next_date": "2026-08-01",
      "created_by": 2,
      "created_by_name": "Sales User",
      "created_at": "2026-07-15T14:30:00Z"
    }
  ]
}
```
- **Error** `404`: `{ "error": "Customer not found" }`

---

### POST `/customers`
Creates a new customer.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**:
```json
{
  "name": "Priya Mehta",
  "mobile": "9123456789",
  "email": "priya@example.com",
  "business_name": "Mehta Supplies",
  "gst_number": "27ABCDE5678F1Z3",
  "customer_type": "RETAIL",
  "address": "Mumbai",
  "status": "LEAD",
  "follow_up_date": "2026-08-10",
  "notes": "Referred by existing customer"
}
```

| Field           | Type   | Required | Rules |
| :-------------- | :----- | :------- | :---- |
| `name`          | string | ✅ | Min 2, Max 150 chars |
| `mobile`        | string | ✅ | 8–15 digits |
| `email`         | string | ❌ | Valid email format |
| `business_name` | string | ❌ | Max 200 chars |
| `gst_number`    | string | ❌ | Max 20 chars |
| `customer_type` | string | ❌ | `RETAIL` \| `WHOLESALE` \| `DISTRIBUTOR` (default: `RETAIL`) |
| `address`       | string | ❌ | Free text |
| `status`        | string | ❌ | `LEAD` \| `ACTIVE` \| `INACTIVE` (default: `LEAD`) |
| `follow_up_date`| string | ❌ | ISO date string |
| `notes`         | string | ❌ | Free text |

- **Success Response** `201 Created`: Returns the created customer object.
- **Error** `400`: Validation errors from Zod schema.

---

### PUT `/customers/:id`
Updates an existing customer's details.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**: Same as `POST /customers`
- **Success Response** `200 OK`: Returns the updated customer object.
- **Error** `404`: `{ "error": "Customer not found" }`

---

### POST `/customers/:id/follow-ups`
Adds a follow-up note to a customer. If `next_date` is provided, it also updates the customer's `follow_up_date`.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**:
```json
{
  "note": "Discussed product catalog. Will call back next week.",
  "next_date": "2026-08-01"
}
```

| Field      | Type   | Required | Rules |
| :--------- | :----- | :------- | :---- |
| `note`     | string | ✅ | Min 1 char |
| `next_date`| string | ❌ | ISO date string |

- **Success Response** `201 Created`:
```json
{
  "id": 5,
  "customer_id": 1,
  "note": "Discussed product catalog. Will call back next week.",
  "next_date": "2026-08-01",
  "created_by": 2,
  "created_at": "2026-07-22T10:00:00Z"
}
```
- **Error** `404`: `{ "error": "Customer not found" }`

---

## 4. Product Endpoints

### GET `/products`
Returns a paginated list of products with optional filters.

- **Auth required**: Yes — any role
- **Query Parameters**:

| Parameter   | Type    | Description |
| :---------- | :------ | :---------- |
| `search`    | string  | Filters by name, SKU, or category (case-insensitive) |
| `low_stock` | boolean | `true` to show only products where `current_stock <= min_stock` |
| `page`      | number  | Page number (default: `1`) |
| `limit`     | number  | Records per page (default: `10`, max: `100`) |

- **Success Response** `200 OK`:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Premium Basmati Rice 5kg",
      "sku": "RICE-BAS-5KG",
      "category": "Grains",
      "unit_price": "450.00",
      "current_stock": 120,
      "min_stock": 20,
      "location": "Warehouse A, Rack 3",
      "created_at": "2026-07-01T09:00:00Z",
      "updated_at": "2026-07-20T11:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 32, "pages": 4 }
}
```

---

### GET `/products/:id`
Returns a single product by ID.

- **Auth required**: Yes — any role
- **Success Response** `200 OK`: Returns the product object.
- **Error** `404`: `{ "error": "Product not found" }`

---

### POST `/products`
Creates a new product. If `current_stock > 0`, an **Opening Stock (IN)** movement is automatically recorded.

- **Auth required**: Yes — `ADMIN`, `WAREHOUSE`
- **Request Body**:
```json
{
  "name": "Premium Basmati Rice 5kg",
  "sku": "RICE-BAS-5KG",
  "category": "Grains",
  "unit_price": 450.00,
  "current_stock": 100,
  "min_stock": 20,
  "location": "Warehouse A, Rack 3"
}
```

| Field           | Type   | Required | Rules |
| :-------------- | :----- | :------- | :---- |
| `name`          | string | ✅ | Min 2, Max 200 chars |
| `sku`           | string | ✅ | Min 2, Max 50 chars. Must be **unique**. |
| `category`      | string | ❌ | Max 100 chars |
| `unit_price`    | number | ✅ | Non-negative |
| `current_stock` | number | ❌ | Non-negative integer (default: `0`) |
| `min_stock`     | number | ❌ | Non-negative integer (default: `0`) |
| `location`      | string | ❌ | Max 100 chars |

- **Success Response** `201 Created`: Returns the created product.
- **Error** `409`: `{ "error": "duplicate key value violates unique constraint" }` — SKU already exists.

---

### PUT `/products/:id`
Updates product details. **Stock cannot be changed here** — use `POST /stock-movements` instead.

- **Auth required**: Yes — `ADMIN`, `WAREHOUSE`
- **Request Body**: Same as `POST /products` (excluding `current_stock`)
- **Success Response** `200 OK`: Returns the updated product.
- **Error** `404`: `{ "error": "Product not found" }`

---

## 5. Stock Movement Endpoints

### GET `/stock-movements`
Returns a paginated audit log of all stock movements (IN and OUT), joined with product and user names.

- **Auth required**: Yes — any role
- **Query Parameters**:

| Parameter    | Type   | Description |
| :----------- | :----- | :---------- |
| `product_id` | number | Filter movements by a specific product |
| `page`       | number | Page number (default: `1`) |
| `limit`      | number | Records per page (default: `15`, max: `100`) |

- **Success Response** `200 OK`:
```json
{
  "data": [
    {
      "id": 12,
      "product_id": 3,
      "product_name": "Toor Dal 1kg",
      "sku": "DAL-TOOR-1KG",
      "quantity": 50,
      "movement_type": "IN",
      "reason": "Restocking from supplier",
      "created_by": 3,
      "created_by_name": "Warehouse User",
      "created_at": "2026-07-20T09:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 15, "total": 88, "pages": 6 }
}
```

---

### POST `/stock-movements`
Records a manual stock IN or OUT movement. OUT movements are blocked (422) if they would push `current_stock` below zero. Uses a **database transaction with `SELECT FOR UPDATE`** to prevent race conditions.

- **Auth required**: Yes — `ADMIN`, `WAREHOUSE`
- **Request Body**:
```json
{
  "product_id": 3,
  "quantity": 50,
  "movement_type": "IN",
  "reason": "Restocking from supplier"
}
```

| Field           | Type   | Required | Rules |
| :-------------- | :----- | :------- | :---- |
| `product_id`    | number | ✅ | Must be a valid existing product ID |
| `quantity`      | number | ✅ | Positive integer |
| `movement_type` | string | ✅ | `IN` \| `OUT` |
| `reason`        | string | ✅ | Min 2, Max 200 chars |

- **Success Response** `201 Created`:
```json
{
  "id": 13,
  "product_id": 3,
  "quantity": 50,
  "movement_type": "IN",
  "reason": "Restocking from supplier",
  "created_by": 3,
  "created_at": "2026-07-22T10:00:00Z"
}
```
- **Error** `404`: Product not found.
- **Error** `422`: `{ "error": "Insufficient stock: available 10, requested 50" }`

---

## 6. Challan Endpoints

Challans are sales dispatch orders. A challan number is auto-generated from a DB sequence in the format `CH-<YEAR>-<5-digit-number>` (e.g. `CH-2026-00001`). Line items store a **snapshot** of product name, SKU, and price at the time of creation, so old challans remain accurate even if products change later.

### GET `/challans`
Returns a paginated list of challans with optional filters.

- **Auth required**: Yes — `ADMIN`, `SALES`, `ACCOUNTS`, `WAREHOUSE`
- **Query Parameters**:

| Parameter     | Type   | Description |
| :------------ | :----- | :---------- |
| `status`      | string | `DRAFT` \| `CONFIRMED` \| `CANCELLED` |
| `customer_id` | number | Filter by a specific customer |
| `search`      | string | Filters by challan number or customer name |
| `page`        | number | Page number (default: `1`) |
| `limit`       | number | Records per page (default: `10`, max: `100`) |

- **Success Response** `200 OK`:
```json
{
  "data": [
    {
      "id": 5,
      "challan_number": "CH-2026-00005",
      "customer_id": 1,
      "customer_name": "Ravi Kumar",
      "status": "CONFIRMED",
      "total_quantity": 10,
      "total_amount": "4500.00",
      "created_by_name": "Sales User",
      "created_at": "2026-07-20T12:00:00Z",
      "updated_at": "2026-07-20T12:05:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 12, "pages": 2 }
}
```

---

### GET `/challans/:id`
Returns a single challan with all its line items and customer snapshot.

- **Auth required**: Yes — `ADMIN`, `SALES`, `ACCOUNTS`, `WAREHOUSE`
- **Success Response** `200 OK`:
```json
{
  "id": 5,
  "challan_number": "CH-2026-00005",
  "customer_id": 1,
  "customer_name": "Ravi Kumar",
  "customer_snapshot": {
    "name": "Ravi Kumar",
    "mobile": "9876543210",
    "business_name": "Kumar Traders",
    "gst_number": "29ABCDE1234F1Z5",
    "address": "Bengaluru",
    "customer_type": "WHOLESALE"
  },
  "status": "CONFIRMED",
  "total_quantity": 10,
  "total_amount": "4500.00",
  "created_by_name": "Sales User",
  "created_at": "2026-07-20T12:00:00Z",
  "items": [
    {
      "id": 8,
      "challan_id": 5,
      "product_id": 1,
      "product_name": "Premium Basmati Rice 5kg",
      "sku": "RICE-BAS-5KG",
      "unit_price": "450.00",
      "quantity": 10,
      "line_total": "4500.00"
    }
  ]
}
```
- **Error** `404`: `{ "error": "Challan not found" }`

---

### POST `/challans`
Creates a new challan. Can be created as `DRAFT` (stock not reduced) or `CONFIRMED` (stock reduced atomically). Duplicate `product_id` entries in `items` are automatically merged.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**:
```json
{
  "customer_id": 1,
  "status": "DRAFT",
  "items": [
    { "product_id": 1, "quantity": 5 },
    { "product_id": 3, "quantity": 2 }
  ]
}
```

| Field         | Type   | Required | Rules |
| :------------ | :----- | :------- | :---- |
| `customer_id` | number | ✅ | Must be a valid existing customer ID |
| `status`      | string | ❌ | `DRAFT` \| `CONFIRMED` (default: `DRAFT`) |
| `items`       | array  | ✅ | At least 1 item. Each item: `{ product_id, quantity }` |

- **Success Response** `201 Created`: Returns the full challan with line items.
- **Error** `400`: Customer or product does not exist.
- **Error** `422`: `{ "error": "Insufficient stock for \"Toor Dal 1kg\": available 1, requested 5" }` — If `CONFIRMED` and any product lacks stock. Nothing is saved on failure (full rollback).

---

### PATCH `/challans/:id/confirm`
Transitions a challan from `DRAFT` → `CONFIRMED`. Reduces stock for all line items atomically inside a transaction. Fails with `422` if any product has insufficient stock.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**: None
- **Success Response** `200 OK`: Returns the updated challan object with `status: "CONFIRMED"`.
- **Error** `404`: Challan not found.
- **Error** `422`: If challan is not in `DRAFT` status, or if stock is insufficient.

---

### PATCH `/challans/:id/cancel`
Cancels a challan. If the challan was `CONFIRMED`, stock is automatically **restored** and `IN` movements are created for each line item.

- **Auth required**: Yes — `ADMIN`, `SALES`
- **Request Body**: None
- **Success Response** `200 OK`: Returns the updated challan object with `status: "CANCELLED"`.
- **Error** `404`: Challan not found.
- **Error** `422`: `{ "error": "Challan is already cancelled" }`

---

## 7. Role Permissions Matrix

| Endpoint | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| :------- | :---: | :---: | :-------: | :------: |
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /auth/me` | ✅ | ✅ | ✅ | ✅ |
| `GET /customers` | ✅ | ✅ | ✅ | ✅ |
| `GET /customers/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /customers` | ✅ | ✅ | ❌ | ❌ |
| `PUT /customers/:id` | ✅ | ✅ | ❌ | ❌ |
| `POST /customers/:id/follow-ups` | ✅ | ✅ | ❌ | ❌ |
| `GET /products` | ✅ | ✅ | ✅ | ✅ |
| `GET /products/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /products` | ✅ | ❌ | ✅ | ❌ |
| `PUT /products/:id` | ✅ | ❌ | ✅ | ❌ |
| `GET /stock-movements` | ✅ | ✅ | ✅ | ✅ |
| `POST /stock-movements` | ✅ | ❌ | ✅ | ❌ |
| `GET /challans` | ✅ | ✅ | ✅ | ✅ |
| `GET /challans/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /challans` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /challans/:id/confirm` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /challans/:id/cancel` | ✅ | ✅ | ❌ | ❌ |

> **Note:** `ADMIN` passes every authorization gate and can perform all actions across all modules.

---

## 8. Error Reference

All errors follow this consistent JSON format:

```json
{ "error": "Human-readable error message" }
```

| Status Code | Meaning |
| :---------- | :------ |
| `400` | Bad Request — validation failed (Zod), or a referenced resource (customer/product) does not exist |
| `401` | Unauthorized — missing or invalid JWT token, or wrong credentials |
| `403` | Forbidden — authenticated user's role is not permitted for this action |
| `404` | Not Found — requested resource does not exist |
| `409` | Conflict — unique constraint violation (e.g., duplicate SKU) |
| `422` | Unprocessable Entity — business rule violation (e.g., insufficient stock, confirming a non-DRAFT challan) |
| `500` | Internal Server Error — unexpected server-side failure |
