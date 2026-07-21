import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { setError("Email and password are required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.token, res.user);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") submit(); };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">F</div>
          <div>
            <h1>Flow<span>Stack</span></h1>
            <div className="tagline">Sign in to FlowStack portal</div>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="form-stack">
          <label className="field">
            Email address
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              onKeyDown={handleKey}
              autoFocus
              autoComplete="email"
            />
          </label>

          <label className="field">
            Password
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={handleKey}
              autoComplete="current-password"
            />
          </label>

          <button
            id="login-submit"
            className="btn primary"
            style={{ width: "100%", padding: "11px" }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </div>

        <div className="demo">
          <strong>Demo credentials</strong>
          <br />
          Admin: <code>admin@erp.com</code> / <code>Admin@123</code>
          <br />
          Sales: <code>sales@erp.com</code> / <code>Sales@123</code>
          <br />
          Warehouse: <code>warehouse@erp.com</code> / <code>Warehouse@123</code>
          <br />
          Accounts: <code>accounts@erp.com</code> / <code>Accounts@123</code>
        </div>
      </div>
    </div>
  );
}
