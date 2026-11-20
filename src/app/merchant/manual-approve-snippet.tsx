// PASTE INTO MERCHANT DASHBOARD - Under each payment in Payments list
"use client";
import { useState } from "react";
export function ManualApproveButtons({ requestId, status, customerName, amount }: { requestId: string; status: string; customerName: string; amount: number }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  if (status === "paid") return <span style={{ color: "#2e7d32", fontWeight: 700 }}>✅ PAID</span>;
  if (status === "rejected") return <span style={{ color: "#c00" }}>❌ Rejected</span>;
  async function act(action: "approve"|"reject") {
    const note = action === "approve" ? prompt("Optional note (e.g. GCash ref you saw):", "") || "" : prompt("Reason for rejecting:", "") || "";
    if (action === "reject" && !confirm(`Reject ${customerName} - P${amount}?`)) return;
    setLoading(true);
    const res = await fetch(`/api/merchant/requests/${requestId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const d = await res.json();
    setMsg(d.message || d.error || "");
    setLoading(false);
    if (res.ok) setTimeout(()=>window.location.reload(), 800);
  }
  return (<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
    <button onClick={()=>act("approve")} disabled={loading} style={{ padding: "10px 16px", borderRadius: 10, background: "#2e7d32", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", flex: 1, minWidth: 120 }}>{loading ? "..." : "✅ Approve Manually"}</button>
    <button onClick={()=>act("reject")} disabled={loading} style={{ padding: "10px 16px", borderRadius: 10, background: "#fff", color: "#c00", border: "1px solid #fbb", fontWeight: 700, cursor: "pointer", flex: 1, minWidth: 120 }}>❌ Reject</button>
    {msg && <div style={{ width: "100%", fontSize: 13 }}>{msg}</div>}
  </div>);
}
