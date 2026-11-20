"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScreenshotUpload from "@/components/ScreenshotUpload";

export default function PayPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch(`/api/requests/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", fontFamily: "system-ui" }}>Loading payment...</div>;
  if (!data || data.error) return <div style={{ padding: 20, textAlign: "center", fontFamily: "system-ui" }}>Payment not found. Link may be expired.</div>;

  const m = data.merchant || {};
  const amount = (data.amountCentavos / 100).toFixed(2);
  const brandColor = m.brandColor || "#d32f2f";
  const emoji = m.brandEmoji || "🎄";
  const brandName = m.brandName || m.name || "PayLinks Store";
  const title = m.checkoutTitle || `${brandName} - P${amount}`;
  const subtitle = m.checkoutSubtitle || `Pay EXACTLY P${amount}`;
  const stepsRaw = m.checkoutSteps || `1. Open GCash > Scan QR\n2. Amount already P${amount} - Confirm\n3. Screenshot receipt\n4. Click I Paid below`;
  const steps = stepsRaw.split("\n").filter(Boolean);
  const footer = m.brandFooter || "Thank you for your payment!";
  const qr = data.amountCentavos === 9900 ? m.gcashQr99 : data.amountCentavos === 14900 ? m.gcashQr149 : m.gcashQrUrl || m.gcashQr99 || m.gcashQr149;
  const isPaid = data.status === "paid";
  const isReview = data.status === "review";

  function copy(t: string, label: string) { navigator.clipboard?.writeText(t); setCopied(label + " copied!"); setTimeout(() => setCopied(""), 2000); }

  // MOBILE PRIORITY: max-width 430px, big tap targets, sticky pay button
  return (
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 16px 100px", fontFamily: "system-ui", background: "#fff", minHeight: "100vh" }}>
      {/* HEADER - Merchant branding */}
      <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>{emoji}</div>
        <h1 style={{ fontSize: 20, margin: "8px 0 2px", lineHeight: 1.2 }}>{brandName}</h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{title}</p>
      </div>

      {/* PAID / REVIEW BANNER */}
      {isPaid && <div style={{ background: "#e6f9e6", border: "1px solid #4caf50", padding: 16, borderRadius: 12, textAlign: "center", marginBottom: 16 }}><div style={{ fontSize: 28 }}>✅</div><b>Payment Verified!</b><br/><span style={{ fontSize: 13 }}>Returning to store...</span></div>}
      {isReview && <div style={{ background: "#fff8e1", border: "1px solid #ffb300", padding: 16, borderRadius: 12, textAlign: "center", marginBottom: 16 }}><b>⏳ Under Review</b><br/><span style={{ fontSize: 13 }}>Dual AI could not fully confirm. Merchant will check manually.</span></div>}

      {/* AMOUNT CARD - Merchant subtitle */}
      <div style={{ background: "#f1f8e9", borderRadius: 16, padding: 20, textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#555" }}>{subtitle}</div>
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: "6px 0" }}>P{amount}</div>
        <div style={{ fontSize: 14, color: "#333" }}>Customer: <b>{data.customerName}</b></div>
        {data.paidAt && <div style={{ fontSize: 12, color: "#666" }}>Paid at: {new Date(data.paidAt).toLocaleString()}</div>}
      </div>

      {/* QR - Large on mobile */}
      {!isPaid && (
        <>
          {qr ? <img src={qr} alt="GCash QR" style={{ width: "100%", maxWidth: 320, display: "block", margin: "0 auto", borderRadius: 12, border: "1px solid #eee" }} /> : <div style={{ background: "#fff3e0", padding: 16, borderRadius: 12, textAlign: "center" }}>Merchant has not uploaded GCash QR for this amount yet. Please send to number below.</div>}
          <p style={{ textAlign: "center", fontSize: 13, color: "#666", margin: "8px 0 16px" }}>Scan this QR in GCash</p>

          {/* PAY TO - Copy buttons big for mobile */}
          <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Pay to:</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <span style={{ fontSize: 14 }}>GCash Name: <b>{m.gcashName || "-"}</b></span>
              <button onClick={() => copy(m.gcashName || "", "Name")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13 }}>Copy</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>GCash No: <b>{m.gcashNumber || "-"}</b></span>
              <button onClick={() => copy(m.gcashNumber || "", "Number")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13 }}>Copy</button>
            </div>
            {copied && <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 8 }}>{copied}</div>}
          </div>

          {/* STEPS - Merchant editable */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>How to pay:</div>
            {steps.map((s: string, i: number) => <div key={i} style={{ fontSize: 14, lineHeight: 1.5, padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>{s}</div>)}
          </div>

          {/* UPLOAD - Fixed component */}
          <ScreenshotUpload requestId={id} />
        </>
      )}

      {/* FOOTER - Merchant footer */}
      <p style={{ textAlign: "center", fontSize: 12, color: "#888", marginTop: 20 }}>{footer}</p>
      <p style={{ textAlign: "center", fontSize: 11, color: "#aaa" }}>Secured by PayLinks • Dual AI Verified</p>

      {/* STICKY BOTTOM - Mobile priority: always visible */}
      {!isPaid && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", padding: "12px 16px", borderTop: "1px solid #eee", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 13, marginBottom: 8 }}>Total: <b>P{amount}</b> • Pay exactly, no extra centavos</div>
        <a href={`https://pasko-photo-magic.lovable.app/?paid=true&requestId=${id}`} style={{ display: "block", textAlign: "center", padding: 14, borderRadius: 12, background: brandColor, color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: 16 }}>I Paid - Check Status →</a>
      </div>}
    </div>
  );
}
