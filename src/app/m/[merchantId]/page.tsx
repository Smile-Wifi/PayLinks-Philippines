"use client";
import { use, useState } from "react";
export default function PublicMerchantPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = use(params);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<any>(null);
  const [fixed, setFixed] = useState<any[]>([]);

  // Load fixed payments for this merchant
  useState(() => {
    fetch(`/api/public/merchant/${merchantId}/fixed`).then(r => r.json()).then(d => setFixed(Array.isArray(d) ? d : [])).catch(() => {});
  });

  async function createPayment(fixedAmount?: number, fixedName?: string) {
    const customerName = name || "Customer";
    const amountPesos = fixedAmount ?? Number(amount);
    if (!amountPesos) return alert("Enter amount");
    const res = await fetch(`/api/public/merchant/${merchantId}/pay`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, amountPesos, label: fixedName || "" }),
    });
    const data = await res.json();
    if (data.amountCentavos) setResult(data);
    else alert(data.error || "Failed");
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>Pay Merchant</h1>
      <p>Scan QR or pay below. You will get a unique exact amount to pay in GCash.</p>
      {!result ? (
        <>
          {fixed.length > 0 && <h3>Fixed Payments - Tap One</h3>}
          {fixed.map((f: any) => (
            <button key={f.id} onClick={() => createPayment(f.amountPesos, f.label)} style={{ display: "block", width: "100%", padding: 14, marginBottom: 8, fontSize: 16, background: "#0b6bff", color: "white", border: "none", borderRadius: 8 }}>
              {f.label} - P{f.amountPesos}
            </button>
          ))}
          <h3>Or Custom Amount</h3>
          <input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginBottom: 8, fontSize: 16 }} />
          <input placeholder="Amount P" type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginBottom: 8, fontSize: 16 }} />
          <button onClick={() => createPayment()} style={{ width: "100%", padding: 14, background: "green", color: "white", fontSize: 18, border: "none", borderRadius: 8 }}>GET EXACT AMOUNT TO PAY</button>
        </>
      ) : (
        <div style={{ background: "#e8f5e9", padding: 20, borderRadius: 12 }}>
          <h2>Pay EXACTLY This in GCash:</h2>
          <div style={{ fontSize: 42, fontWeight: "bold" }}>P{(result.amountCentavos / 100).toFixed(2)}</div>
          <p>Do NOT pay P{(result.baseAmount / 100).toFixed(2)} - pay the exact amount with centavos above.</p>
          <p>Customer: {result.customerName}</p>
          <a href={`/pay/${result.id}`} style={{ display: "inline-block", marginTop: 10, padding: "12px 20px", background: "#0b6bff", color: "white", borderRadius: 8, textDecoration: "none" }}>View Receipt / Status</a>
          <br /><button onClick={() => setResult(null)} style={{ marginTop: 12 }}>Pay Another</button>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <img src={qrUrl} alt="Merchant QR" />
        <p style={{ fontSize: 12, color: "#666" }}>Share this QR - it opens this page</p>
      </div>
    </div>
  );
}
