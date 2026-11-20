"use client";
import { use, useEffect, useState } from "react";
export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [req, setReq] = useState<any>(null);
  const [step, setStep] = useState<"pay" | "upload" | "checking" | "done">("pay");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { fetch(`/api/requests/${id}`).then(r => r.json()).then(d => setReq(d)).catch(() => {}); }, [id]);
  async function copy(text: string, label: string) { try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 2000); } catch {} }
  async function submitScreenshot() {
    if (!file) return alert("Please choose screenshot first");
    setStep("checking");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/validate-screenshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, imageBase64: base64, mimeType: file.type || "image/jpeg" }) });
        const data = await res.json(); setResult(data); setStep("done");
      } catch { setStep("upload"); alert("Failed to check. Try again."); }
    };
    reader.readAsDataURL(file);
  }
  if (!req) return <div style={{ padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>Loading...</div>;
  const amount = (req.amountCentavos / 100).toFixed(2);
  const is99 = req.amountCentavos === 9900; const is149 = req.amountCentavos === 14900;
  const packageName = is99 ? "Basic - P99" : is149 ? "Premium - P149" : `Payment P${amount}`;
  const m = req.merchant || {};
  const qrUrl = is99 ? (m.gcashQr99 || m.gcashQrUrl) : is149 ? (m.gcashQr149 || m.gcashQrUrl) : m.gcashQrUrl;
  const gcashName = m.gcashName || m.name || ""; const gcashNumber = m.gcashNumber || "";
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>{m.brandName || m.name || "PayLinks"}</h1><h2>{packageName}</h2>
      {step === "pay" && (<>
        <div style={{ background: "#e8f5e9", padding: 20, borderRadius: 12 }}><div style={{ fontSize: 14 }}>Pay EXACTLY:</div><div style={{ fontSize: 42, fontWeight: "bold" }}>P{amount}</div><div style={{ fontSize: 13 }}>Customer: {req.customerName}</div></div>
        {qrUrl ? (<div style={{ marginTop: 16 }}><img src={qrUrl} alt={`GCash QR for P${amount}`} style={{ width: 260, height: 260, objectFit: "contain", border: "1px solid #ddd", borderRadius: 12 }} /><p style={{ fontSize: 13 }}>Scan this QR in GCash</p></div>) : (<p style={{ background: "#fff3e0", padding: 12, borderRadius: 8, fontSize: 13 }}>Merchant has not uploaded QR for P{amount} yet. Send manually below.</p>)}
        {(gcashName || gcashNumber) && (<div style={{ marginTop: 12, background: "#f5f5f5", padding: 14, borderRadius: 12, textAlign: "left" }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>Pay to:</div>
          {gcashName && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>GCash Name: <b>{gcashName}</b></span><button onClick={() => copy(gcashName, "name")}>{copied === "name" ? "Copied!" : "Copy"}</button></div>}
          {gcashNumber && <div style={{ display: "flex", justifyContent: "space-between" }}><span>GCash No: <b>{gcashNumber}</b></span><button onClick={() => copy(gcashNumber, "number")}>{copied === "number" ? "Copied!" : "Copy"}</button></div>}
        </div>)}
        <p style={{ fontSize: 13 }}>1. Open GCash &gt; Scan QR or Send to number above<br />2. Amount already P{amount} - Confirm<br />3. Screenshot receipt<br />4. Click I Paid below</p>
        <button onClick={() => setStep("upload")} style={{ width: "100%", padding: 14, marginTop: 12, background: "green", color: "white", fontSize: 18, border: "none", borderRadius: 8 }}>I PAID - UPLOAD SCREENSHOT</button>
      </>)}
      {step === "upload" && (<><h3>Upload GCash Receipt Screenshot</h3><p style={{ fontSize: 13 }}>Both AIs (Gemini + OpenAI) will check it. Both must agree.</p><input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} style={{ margin: "12px 0" }} />{preview && <img src={preview} alt="Receipt" style={{ width: "100%", maxHeight: 320, objectFit: "contain", border: "1px solid #ddd", borderRadius: 8 }} />}<button onClick={submitScreenshot} disabled={!file} style={{ width: "100%", padding: 14, marginTop: 12, background: "#0b6bff", color: "white", fontSize: 18, border: "none", borderRadius: 8 }}>CHECK WITH DUAL AI</button><button onClick={() => setStep("pay")} style={{ marginTop: 8 }}>Back</button></>)}
      {step === "checking" && <div style={{ padding: 30 }}><h2>Checking with Dual AI...</h2><p>Gemini + OpenAI are both reading your screenshot. Please wait 5-10 seconds.</p></div>}
      {step === "done" && result && (<>{result.status === "paid" ? (<div style={{ background: "#e8f5e9", padding: 20, borderRadius: 12 }}><h2>PAID ✅</h2><p>Verified by BOTH AIs. Thank you!</p><p style={{ fontSize: 13 }}>{result.dual?.reason}</p></div>) : (<div style={{ background: "#fff3e0", padding: 20, borderRadius: 12 }}><h2>UNDER REVIEW 👀</h2><p>{result.message}</p><p style={{ fontSize: 13 }}>{result.dual?.reason}</p><button onClick={() => setStep("upload")} style={{ marginTop: 12, padding: "10px 16px" }}>Upload Clearer Screenshot</button></div>)}</>)}
    </div>
  );
}
