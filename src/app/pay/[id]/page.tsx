"use client";
import { use, useEffect, useState } from "react";

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [req, setReq] = useState<any>(null);
  const [step, setStep] = useState<"pay" | "upload" | "checking" | "done">("pay");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/requests/${id}`).then(r => r.json()).then(d => setReq(d)).catch(() => {});
  }, [id]);

  async function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submitScreenshot() {
    if (!file) return alert("Please choose screenshot first");
    setStep("checking"); setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/validate-screenshot", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: id, imageBase64: base64, mimeType: file.type || "image/jpeg" }),
        });
        const data = await res.json();
        setResult(data);
        setStep("done");
      } catch (e) {
        setError("Failed to check. Try again.");
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  }

  if (!req) return <div style={{ padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>Loading...</div>;
  const amount = (req.amountCentavos / 100).toFixed(2);
  const is99 = req.amountCentavos === 9900;
  const is149 = req.amountCentavos === 14900;
  const packageName = is99 ? "Basic - P99" : is149 ? "Premium - P149" : `Payment P${amount}`;
  // Merchant GCash QR for this package - merchant uploads these in dashboard (v1: stored as URLs in merchant record, fallback to placeholder)
  const gcashQrUrl = req.merchant?.gcashQr99 && is99 ? req.merchant.gcashQr99 : req.merchant?.gcashQr149 && is149 ? req.merchant.gcashQr149 : req.merchant?.gcashQrUrl || "";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>{req.merchant?.brandName || req.merchant?.name || "PayLinks"}</h1>
      <h2>{packageName}</h2>

      {step === "pay" && (
        <>
          <div style={{ background: "#e8f5e9", padding: 20, borderRadius: 12 }}>
            <div style={{ fontSize: 14 }}>Pay EXACTLY:</div>
            <div style={{ fontSize: 42, fontWeight: "bold" }}>P{amount}</div>
            <div style={{ fontSize: 13 }}>Customer: {req.customerName}</div>
          </div>
          {gcashQrUrl ? (
            <div style={{ marginTop: 16 }}>
              <img src={gcashQrUrl} alt="GCash QR" style={{ width: 240, height: 240, objectFit: "contain", border: "1px solid #ddd", borderRadius: 12 }} />
              <p style={{ fontSize: 13 }}>1. Open GCash &gt; Scan this QR<br />2. Amount already P{amount} - just Confirm<br />3. Then click I Paid below</p>
            </div>
          ) : (
            <p style={{ fontSize: 13, marginTop: 12 }}>1. Open GCash<br />2. Send <b>P{amount}</b> to merchant<br />3. Screenshot the receipt<br />4. Click I Paid below</p>
          )}
          <button onClick={() => setStep("upload")} style={{ width: "100%", padding: 14, marginTop: 12, background: "green", color: "white", fontSize: 18, border: "none", borderRadius: 8 }}>I PAID - UPLOAD SCREENSHOT</button>
        </>
      )}

      {step === "upload" && (
        <>
          <h3>Upload GCash Receipt Screenshot</h3>
          <p style={{ fontSize: 13 }}>Both AIs (Gemini + OpenAI) will check it. Both must agree before auto-approve.</p>
          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ margin: "12px 0" }} />
          {preview && <img src={preview} alt="Receipt preview" style={{ width: "100%", maxHeight: 320, objectFit: "contain", border: "1px solid #ddd", borderRadius: 8 }} />}
          <button onClick={submitScreenshot} disabled={!file} style={{ width: "100%", padding: 14, marginTop: 12, background: "#0b6bff", color: "white", fontSize: 18, border: "none", borderRadius: 8 }}>CHECK WITH DUAL AI</button>
          <button onClick={() => setStep("pay")} style={{ marginTop: 8 }}>Back</button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}

      {step === "checking" && (
        <div style={{ padding: 30 }}>
          <h2>Checking with Dual AI...</h2>
          <p>Gemini + OpenAI are both reading your screenshot.<br />Please wait 5-10 seconds. Do not close.</p>
        </div>
      )}

      {step === "done" && result && (
        <>
          {result.status === "paid" ? (
            <div style={{ background: "#e8f5e9", padding: 20, borderRadius: 12 }}>
              <h2>PAID ✅</h2>
              <p>Verified by BOTH AIs. Thank you!</p>
              <p style={{ fontSize: 13 }}>{result.dual?.reason}</p>
              {result.dual?.finalRef && <p>Ref: {result.dual.finalRef}</p>}
            </div>
          ) : (
            <div style={{ background: "#fff3e0", padding: 20, borderRadius: 12 }}>
              <h2>UNDER REVIEW 👀</h2>
              <p>{result.message || "AIs did not fully agree. Merchant will check manually."}</p>
              <p style={{ fontSize: 13 }}>{result.dual?.reason}</p>
              <p style={{ fontSize: 12 }}>Gemini: {result.dual?.gemini?.amountCentavos} / {result.dual?.gemini?.gcashRef} / {result.dual?.gemini?.confidence}%<br />OpenAI: {result.dual?.openai?.amountCentavos} / {result.dual?.openai?.gcashRef} / {result.dual?.openai?.confidence}%</p>
              <button onClick={() => setStep("upload")} style={{ marginTop: 12, padding: "10px 16px" }}>Upload Clearer Screenshot</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
