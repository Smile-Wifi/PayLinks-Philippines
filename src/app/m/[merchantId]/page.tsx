"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function MerchantStorePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const merchantId = params.merchantId as string;
  const pkgFromUrl = searchParams.get("package") || searchParams.get("amount") || "";
  const [pkg, setPkg] = useState(pkgFromUrl === "149" ? "149" : "99");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [merchantName, setMerchantName] = useState("Pasko Photo Magic");

  useEffect(() => {
    if (pkgFromUrl === "99" || pkgFromUrl === "149") setPkg(pkgFromUrl);
    // Try to load merchant brand for display - ignore errors
    fetch(`/api/merchant/public/${merchantId}`).then(r => r.json()).then(d => {
      if (d?.brandName) setMerchantName(d.brandName);
      if (d?.name) setMerchantName(d.name);
    }).catch(() => {});
  }, [pkgFromUrl, merchantId]);

  async function handlePay() {
    if (!name.trim()) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/public/merchant/${merchantId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name.trim(), amountPesos: Number(pkg) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create payment");
      // Redirect to real checkout - each customer gets OWN /pay/xxx link
      // This is why fixed links work for unlimited customers
      window.location.href = data.checkoutUrl || `/pay/${data.requestId}`;
    } catch (e: any) {
      setError(e?.message || "Failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, fontFamily: "system-ui", background: "#fff", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 48 }}>🎄</div>
        <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>{merchantName}</h1>
        <p style={{ color: "#666", margin: 0 }}>Pay with GCash - Fixed Price</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={() => setPkg("99")} style={{ flex: 1, padding: 16, borderRadius: 12, border: pkg === "99" ? "2px solid #d32f2f" : "1px solid #ddd", background: pkg === "99" ? "#fff1f1" : "#fff", cursor: "pointer" }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>₱99</div>
          <div style={{ fontSize: 13, color: "#666" }}>5 Christmas Photos</div>
        </button>
        <button onClick={() => setPkg("149")} style={{ flex: 1, padding: 16, borderRadius: 12, border: pkg === "149" ? "2px solid #d32f2f" : "1px solid #ddd", background: pkg === "149" ? "#fff1f1" : "#fff", cursor: "pointer" }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>₱149</div>
          <div style={{ fontSize: 13, color: "#666" }}>5 Christmas Photos</div>
        </button>
      </div>

      <label style={{ fontSize: 14, fontWeight: 600 }}>Your Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ANA SANTOS" style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ddd", marginTop: 6, marginBottom: 16, fontSize: 16, boxSizing: "border-box" }} />

      <div style={{ background: "#f8f8f8", padding: 14, borderRadius: 10, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <span>To Pay:</span><b style={{ fontSize: 18 }}>₱{pkg}.00</b>
      </div>

      {error && <div style={{ background: "#ffecec", color: "#c00", padding: 12, borderRadius: 10, marginBottom: 12 }}>{error}</div>}

      <button onClick={handlePay} disabled={loading} style={{ width: "100%", padding: 16, borderRadius: 12, background: "#d32f2f", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
        {loading ? "Creating your payment..." : `Pay ₱${pkg} with GCash →`}
      </button>

      <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginTop: 16 }}>
        You will see your GCash QR on the next page.<br/>Pay EXACT ₱{pkg}.00 - no extra centavos.
      </p>
    </div>
  );
}
