"use client";
import { useEffect, useState } from "react";
export default function MerchantDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [fixedLabel, setFixedLabel] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedList, setFixedList] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch("/api/merchant/requests").then(r => r.json()).then(d => setRequests(Array.isArray(d) ? d : []));
    fetch("/api/merchant/me").then(r => r.json()).then(d => { if (d.id) { setMerchantId(d.id); setMe(d); } }).catch(() => {});
    const saved = localStorage.getItem("fixedPayments");
    if (saved) setFixedList(JSON.parse(saved));
  }, []);

  const saveFixed = (list: any[]) => { setFixedList(list); localStorage.setItem("fixedPayments", JSON.stringify(list)); };
  const addFixed = () => {
    if (!fixedLabel || !fixedAmount) return alert("Enter label + amount");
    saveFixed([...fixedList, { id: Date.now().toString(), label: fixedLabel, amountPesos: Number(fixedAmount) }]);
    setFixedLabel(""); setFixedAmount("");
  };

  async function create(e: any) {
    e.preventDefault();
    await fetch("/api/merchant/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: name, amountPesos: Number(amount) }) });
    setName(""); setAmount("");
    fetch("/api/merchant/requests").then(r => r.json()).then(d => setRequests(Array.isArray(d) ? d : []));
  }

  // NEW: Upload GCash QR for 99 / 149 - from phone gallery
  async function uploadQR(pkg: "99" | "149", file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(",")[1];
      const res = await fetch("/api/merchant/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ package: pkg, imageBase64: b64, mimeType: file.type }) });
      const d = await res.json();
      if (d.ok) {
        alert(d.message);
        // Refresh me to show new QR
        const m = await fetch("/api/merchant/me").then(r => r.json());
        setMe(m);
      } else alert(d.error);
    };
    reader.readAsDataURL(file);
  }

  const totalPaid = requests.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + r.amountCentavos / 100, 0);
  const publicUrl = merchantId ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${merchantId}` : "";
  const qrImg = publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}` : "";

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>My Store</h1>
      <div style={{ background: "#e8f5e9", padding: 16, borderRadius: 8 }}><b>Today Paid: P{totalPaid.toFixed(2)}</b></div>
      {me && <p style={{ fontSize: 13 }}>Store: <b>{me.brandName || me.name}</b> | 【entity-GCash¦canonical_name=GCash】: <b>{me.gcashName || ""}</b> {me.gcashNumber || ""}</p>}

      <div style={{ border: "2px dashed #0b6bff", padding: 16, marginTop: 16, borderRadius: 12, textAlign: "center" }}>
        <h2>Your Merchant QR - Print This</h2>
        {qrImg ? (<><img src={qrImg} alt="Merchant QR" /><p style={{ wordBreak: "break-all" }}>{publicUrl}</p><button onClick={() => { navigator.clipboard.writeText(publicUrl); alert("Link copied!"); }}>Copy Link</button> <button onClick={() => window.print()}>Print QR</button></>) : (<p>Loading QR...</p>)}
        <p style={{ fontSize: 13, color: "#555" }}>Customer scans QR - enters name - gets exact amount to pay. No need to create payment one-by-one.</p>
      </div>

      {/* NEW: 【entity-GCash¦canonical_name=GCash】 QR Upload - This is the payment QR, different from above */}
      <div style={{ border: "2px solid #0b6bff", padding: 16, marginTop: 16, borderRadius: 12 }}>
        <h2>【entity-GCash¦canonical_name=GCash】 QR - For Payment (Upload From Phone)</h2>
        <p style={{ fontSize: 13 }}>This is the QR customer scans to PAY in 【entity-GCash¦canonical_name=GCash】 app. Different from Merchant QR above. Upload QR you saved from GCash app.</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, border: "1px solid #ddd", padding: 12, borderRadius: 8, textAlign: "center" }}>
            <b>QR for ₱99</b><br />{me?.gcashQr99 ? "✅ Uploaded" : "❌ Missing"}<br />
            {me?.gcashQr99 && <img src={me.gcashQr99} style={{ width: 140, height: 140, objectFit: "contain" }} />}<br />
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadQR("99", e.target.files[0])} />
            <p style={{ fontSize: 11 }}>GCash app → QR → Set ₱99 → Save → Upload here</p>
          </div>
          <div style={{ flex: 1, minWidth: 200, border: "1px solid #ddd", padding: 12, borderRadius: 8, textAlign: "center" }}>
            <b>QR for ₱149</b><br />{me?.gcashQr149 ? "✅ Uploaded" : "❌ Missing"}<br />
            {me?.gcashQr149 && <img src={me.gcashQr149} style={{ width: 140, height: 140, objectFit: "contain" }} />}<br />
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadQR("149", e.target.files[0])} />
            <p style={{ fontSize: 11 }}>GCash app → QR → Set ₱149 → Save → Upload here</p>
          </div>
        </div>
      </div>

      <h2>Fixed Payments - Same Price For All Customers</h2>
      <p style={{ fontSize: 13 }}>Example: Membership P149, T-shirt P299, Entrance P99. Customer taps one on your QR page.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Label - Membership" value={fixedLabel} onChange={e => setFixedLabel(e.target.value)} />
        <input placeholder="Amount P" type="number" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} />
        <button onClick={addFixed} style={{ background: "#0b6bff", color: "white", padding: "10px 16px" }}>+ ADD FIXED</button>
      </div>
      {fixedList.map((f: any) => (<div key={f.id} style={{ border: "1px solid #ddd", padding: 10, marginTop: 8 }}>{f.label} - P{f.amountPesos} <button onClick={() => saveFixed(fixedList.filter(x => x.id !== f.id))}>Delete</button></div>))}

      <h2>+ New Payment (One Customer)</h2>
      <form onSubmit={create} style={{ display: "flex", gap: 8 }}>
        <input placeholder="Customer Name" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Amount P" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
        <button style={{ background: "green", color: "white", padding: "10px 16px" }}>CREATE LINK</button>
      </form>

      <h2>Payments</h2>
      {requests.map((r: any) => (
        <div key={r.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
          <b>{r.customerName}</b> - P{(r.amountCentavos / 100).toFixed(2)} - {r.status.toUpperCase()}
          <br /><button onClick={() => navigator.clipboard.writeText(`${location.origin}/pay/${r.id}`)}>Copy Link</button>
        </div>
      ))}
    </div>
  );
}