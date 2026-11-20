"use client";
import { useEffect, useState } from "react";
export default function MerchantDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const load = () => fetch("/api/merchant/requests").then(r => r.json()).then(d => setRequests(Array.isArray(d) ? d : []));
  useEffect(() => { load(); }, []);
  async function create(e: any) {
    e.preventDefault();
    await fetch("/api/merchant/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: name, amountPesos: Number(amount) }) });
    setName(""); setAmount(""); load();
  }
  const totalPaid = requests.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + r.amountCentavos / 100, 0);
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>My Store</h1>
      <div style={{ background: "#e8f5e9", padding: 16, borderRadius: 8 }}><b>Today Paid: P{totalPaid.toFixed(2)}</b></div>
      <h2>+ New Payment</h2>
      <form onSubmit={create} style={{ display: "flex", gap: 8 }}>
        <input placeholder="Customer Name" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Amount P" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
        <button style={{ background: "green", color: "white", padding: "10px 16px" }}>CREATE LINK</button>
      </form>
      <h2>Payments</h2>
      {requests.map((r: any) => (
        <div key={r.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
          <b>{r.customerName}</b> - P{(r.amountCentavos / 100).toFixed(2)} - {r.status.toUpperCase()}
          <br />
          <button onClick={() => navigator.clipboard.writeText(`${location.origin}/pay/${r.id}`)}>Copy Link</button>
        </div>
      ))}
    </div>
  );
}
