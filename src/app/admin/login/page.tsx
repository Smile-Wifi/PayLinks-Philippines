"use client";
import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Login failed");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "60px auto",
        padding: 20,
        fontFamily: "system-ui",
      }}
    >
      <h1>🔐 Super Admin</h1>
      <p style={{ color: "#666" }}>Platform control plane</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Super Admin Password"
        autoComplete="current-password"
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "1px solid #ddd",
          marginBottom: 12,
        }}
        onKeyDown={(e) => e.key === "Enter" && !loading && login()}
      />
      {error && (
        <div
          style={{
            background: "#ffecec",
            color: "#c00",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <button
        onClick={login}
        disabled={loading}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          background: "#111",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Signing in…" : "Login as Super Admin"}
      </button>
      <p style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
        Password is set via the <code>SUPER_ADMIN_PASSWORD</code> environment
        variable (minimum 12 characters). There is no default password.
      </p>
    </div>
  );
}
