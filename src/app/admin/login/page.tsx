"use client";
import { useState } from "react";
export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function login() {
    setError("");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const d = await res.json().catch(()=>({}));
    if (!res.ok) { setError(d.error || "Login failed"); return; }
    window.location.href = "/admin";
  }
  return (<div style={{ maxWidth: 400, margin: "60px auto", padding: 20, fontFamily: "system-ui" }}>
    <h1>🔐 Super Admin</h1><p style={{color:"#666"}}>Control all merchants</p>
    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Super Admin Password" style={{ width:"100%", padding:14, borderRadius:10, border:"1px solid #ddd", marginBottom:12 }} onKeyDown={e=>e.key==="Enter" && login()} />
    {error && <div style={{background:"#ffecec",color:"#c00",padding:10,borderRadius:8,marginBottom:12}}>{error}</div>}
    <button onClick={login} style={{ width:"100%", padding:14, borderRadius:10, background:"#111", color:"#fff", border:"none", fontWeight:700, cursor:"pointer" }}>Login as Super Admin</button>
    <p style={{fontSize:12,color:"#888",marginTop:12}}>Default password: admin1234 - Change it in Vercel env SUPER_ADMIN_PASSWORD</p>
  </div>);
}
