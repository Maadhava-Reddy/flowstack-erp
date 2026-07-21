/// <reference types="vite/client" />
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Auto-logout on 401 (except on the login route itself)
    if (res.status === 401 && !path.startsWith("/auth/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new ApiError(res.status, body.error || "Request failed", body.details);
  }

  return body;
}

export const api = {
  get:    (path: string)                  => request(path),
  post:   (path: string, data: unknown)   => request(path, { method: "POST",   body: JSON.stringify(data) }),
  put:    (path: string, data: unknown)   => request(path, { method: "PUT",    body: JSON.stringify(data) }),
  patch:  (path: string, data: unknown = {}) => request(path, { method: "PATCH",  body: JSON.stringify(data) }),
  delete: (path: string)                  => request(path, { method: "DELETE" }),
};
