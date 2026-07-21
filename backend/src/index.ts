import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import productRoutes from "./routes/products";
import stockRoutes from "./routes/stock";
import challanRoutes from "./routes/challans";
import { errorHandler } from "./middleware/error";

const app = express();

const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(s => s.trim());
app.use(cors({ origin: origins }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "flowstack-api" }));

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/products", productRoutes);
app.use("/stock-movements", stockRoutes);
app.use("/challans", challanRoutes);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`ERP-CRM API listening on :${port}`));
