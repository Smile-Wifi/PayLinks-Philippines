"use client";
import { useEffect, useState } from "react";
export default function AdminPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", gcashNumber: "", gcashName: "", pin: "" });
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/admin/merchants").then(r => r.json()).then(setMerchants);
  useEffect(() => { load(); }, []);
  async function create(e: any) {
    e.preventDefault();
    const res = await fetch("/api/admin/merchants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) { setMsg(`Created! Send to merchant: Login ${form.gcashNumber} / PIN ${form.pin}`); setForm({ name: "", gcashNumber: "", gcashName: "", pin: "" }); load(); }
    else setMsg("Error: " + data.error);
  }
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>Owner Admin</h1>
      <h2>+ New Merchant</h2>
      <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input placeholder="Store Name - Ana's Sari-Sari Store" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="GCash Number - 09171234567" value={form.gcashNumber} onChange={e => setForm({ ...form, gcashNumber: e.target.value })} required />
        <input placeholder="GCash Name - ANA SANTOS" value={form.gcashName} onChange={e => setForm({ ...form, gcashName: e.target.value })} required />
        <input placeholder="PIN - 1234" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} required />
        <button style={{ background: "green", color: "white", padding: 12, fontSize: 16 }}>Create Merchant</button>
      </form>
      {msg && <p>{msg}</p>}
      <h2>All Merchants ({merchants.length})</h2>
      {merchants.map((m: any) => (
        <div key={m.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
          <b>{m.name}</b><br />{m.gcashNumber} - {m.gcashName}
        </div>
      ))}
    </div>
  );
}
