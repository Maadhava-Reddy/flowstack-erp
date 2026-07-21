import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/** Central error handler: turns Zod + PG errors into clean JSON responses */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
    });
  }
  if (err?.code === "23505") {
    return res.status(409).json({ error: "Duplicate value violates a unique constraint", detail: err.detail });
  }
  if (err?.code === "23503") {
    return res.status(400).json({ error: "Referenced record does not exist", detail: err.detail });
  }
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

/** Helper to throw HTTP errors from route logic */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
