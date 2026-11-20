"use client";
import { useEffect, useState } from "react";

export default function MerchantDashboard() {
  const [me, setMe] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [branding, setBranding] = useState({ brandName:"", brandEmoji:"🎄", brandColor:"#d32f2f", brandFooter:"Thank you for your payment!", checkoutTitle:"", checkoutSubtitle:"", checkoutSteps:"1. Open GCash > Scan QR\n2. Amount already set - Confirm\n3. Screenshot receipt\n4. Click I Paid below" });
  const [showBranding, setShowBranding] = useState(false);
  const [newPay, setNewPay] = useState({ customerName:"", amountPesos:"99" });

  async function load() {
    const [meRes, payRes] = await Promise.all([fetch("/api/merchant/me"), fetch("/api/requests")]);
    if (meRes.status===401) { window.location.href="/merchant/login"; return; }
    const meData = await meRes.json().catch(()=>({}));
    setMe(meData);
    const payData = await payRes.json().catch(()=>({}));
    setPayments(payData.requests || payData || []);
    // branding
    const b = await fetch("/api/merchant/branding").then(r=>r.json()).catch(()=>({}));
    if (!b.error) setBranding((p)=>({...p, ...b, checkoutSteps: b.checkoutSteps || p.checkoutSteps}));
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function saveBranding() {
    setMsg("Saving design...");
    const r = await fetch("/api/merchant/branding", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(branding) });
    const d = await r.json(); setMsg(d.message || d.error || "Saved");
  }
  async function uploadQR(pkg: string, file: File) {
    setMsg("Uploading QR...");
    const base64 = await new Promise<string>((resolve, reject) => { const rd = new FileReader(); rd.onload = () => resolve((rd.result as string).split(",")[1]); rd.onerror = () => reject(new Error("read failed")); rd.readAsDataURL(file); });
    const r = await fetch("/api/merchant/qr", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ package: pkg, imageBase64: base64, mimeType: file.type }) });
    const d = await r.json(); setMsg(d.message || d.error || "Done"); load();
  }
  async function createPayment() {
    if (!newPay.customerName.trim()) { setMsg("Enter customer name"); return; }
    const r = await fetch("/api/requests", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ customerName: newPay.customerName, amountPesos: Number(newPay.amountPesos) }) });
    const d = await r.json(); if (!r.ok) { setMsg(d.error||"Failed"); return; } setMsg("✅ Link created"); load();
  }
  async function manual(action: "approve"|"reject", req: any) {
    const note = action==="approve" ? prompt("Optional note (GCash ref you saw):","")||"" : prompt("Reason for rejecting:","")||"";
    if (action==="reject" && !confirm(`Reject ${req.customerName} - P${(req.amountCentavos/100).toFixed(2)}?`)) return;
    const r = await fetch(`/api/merchant/requests/${req.id}/approve`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action, note }) });
    const d = await r.json(); setMsg(d.message||d.error||""); load();
  }
  async function copyLink(text: string) { try{ await navigator.clipboard.writeText(text); setMsg("Link copied!"); }catch{ setMsg(text); } }

  if (loading) return <div style={{padding:20,fontFamily:"system-ui"}}>Loading store...</div>;
  const todayPaid = payments.filter((p:any)=>p.status==="paid" && new Date(p.paidAt||p.createdAt).toDateString()===new Date().toDateString()).reduce((s:number,p:any)=>s+p.amountCentavos,0);

  return (<div style={{ maxWidth: 480, margin:"0 auto", padding:"16px 16px 80px", fontFamily:"system-ui", background:"#fff", minHeight:"100vh" }}>
    <h1 style={{fontSize:22,margin:"0 0 4px"}}>My Store</h1>
    <p style={{color:"#666",fontSize:13,margin:"0 0 12px"}}>Today Paid: <b>P{(todayPaid/100).toFixed(2)}</b></p>
    <div style={{background:"#f8f8f8",padding:12,borderRadius:10,marginBottom:12,fontSize:13}}>Store: <b>{me?.brandName||me?.name}</b> | GCash: <b>{me?.gcashName||"-"} {me?.gcashNumber||""}</b></div>
    {msg && <div style={{background:"#e8ffe8",padding:10,borderRadius:8,marginBottom:12,fontSize:13,wordBreak:"break-all"}}>{msg}</div>}

    {/* FIXED LINKS */}
    <div style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:12}}>
      <b>Your Merchant QR - Print This</b>
      <div style={{fontSize:12,wordBreak:"break-all",color:"#333",margin:"8px 0"}}>https://paylinks-philippines.vercel.app/m/{me?.id}</div>
      <button onClick={()=>copyLink(`https://paylinks-philippines.vercel.app/m/${me?.id}`)} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #ddd",background:"#fff",marginRight:8}}>Copy Link</button>
      <button onClick={()=>window.print()} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #ddd",background:"#fff"}}>Print QR</button>
      <p style={{fontSize:12,color:"#666"}}>Customer scans QR - enters name - gets exact amount to pay. No need to create payment one-by-one.</p>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>copyLink(`https://paylinks-philippines.vercel.app/m/${me?.id}?package=99`)} style={{flex:1,padding:12,borderRadius:8,background:"#d32f2f",color:"#fff",border:"none",fontWeight:700}}>Copy P99 Link</button>
        <button onClick={()=>copyLink(`https://paylinks-philippines.vercel.app/m/${me?.id}?package=149`)} style={{flex:1,padding:12,borderRadius:8,background:"#111",color:"#fff",border:"none",fontWeight:700}}>Copy P149 Link</button>
      </div>
    </div>

    {/* BRANDING */}
    <div style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><b>🎨 Design Your Pay Page</b><button onClick={()=>setShowBranding(!showBranding)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #ddd",background:"#fff"}}>{showBranding?"Hide":"Edit"}</button></div>
      {showBranding && <div style={{marginTop:10,display:"grid",gap:8}}>
        <input placeholder="Store Name" value={branding.brandName} onChange={e=>setBranding({...branding,brandName:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <input placeholder="Emoji 🎄" value={branding.brandEmoji} onChange={e=>setBranding({...branding,brandEmoji:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <input type="color" value={branding.brandColor} onChange={e=>setBranding({...branding,brandColor:e.target.value})} style={{height:40}} />
        <input placeholder="Pay Page Title" value={branding.checkoutTitle} onChange={e=>setBranding({...branding,checkoutTitle:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <input placeholder="Pay Page Subtitle" value={branding.checkoutSubtitle} onChange={e=>setBranding({...branding,checkoutSubtitle:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <textarea placeholder="Steps, one per line" value={branding.checkoutSteps} onChange={e=>setBranding({...branding,checkoutSteps:e.target.value})} rows={4} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <input placeholder="Footer" value={branding.brandFooter} onChange={e=>setBranding({...branding,brandFooter:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}} />
        <button onClick={saveBranding} style={{padding:12,borderRadius:8,background:branding.brandColor,color:"#fff",border:"none",fontWeight:700}}>Save Design</button>
      </div>}
    </div>

    {/* QR UPLOAD */}
    <div style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:12}}>
      <b>GCash QR - For Payment (Upload From Phone)</b>
      <p style={{fontSize:12,color:"#666"}}>This is the QR customer scans to PAY in GCash app. Different from Merchant QR above. Upload QR you saved from GCash app.</p>
      <div style={{marginBottom:10}}><b>QR for ₱99 {me?.gcashQr99 ? "✅ Uploaded" : "❌ Not uploaded"}</b><br/><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadQR("99", f); }} /><br/><span style={{fontSize:12,color:"#666"}}>GCash app → QR → Set ₱99 → Save → Upload here</span></div>
      <div><b>QR for ₱149 {me?.gcashQr149 ? "✅ Uploaded" : "❌ Not uploaded"}</b><br/><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadQR("149", f); }} /><br/><span style={{fontSize:12,color:"#666"}}>GCash app → QR → Set ₱149 → Save → Upload here</span></div>
      {(me?.gcashQr99 || me?.gcashQr149) && <div style={{display:"flex",gap:8,marginTop:10}}>{me?.gcashQr99 && <img src={me.gcashQr99} style={{width:120,borderRadius:8}} />}{me?.gcashQr149 && <img src={me.gcashQr149} style={{width:120,borderRadius:8}} />}</div>}
    </div>

    {/* NEW PAYMENT */}
    <div style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:12}}>
      <b>+ New Payment (One Customer)</b>
      <div style={{display:"flex",gap:8,marginTop:10}}><input placeholder="Customer Name" value={newPay.customerName} onChange={e=>setNewPay({...newPay,customerName:e.target.value})} style={{flex:1,padding:10,borderRadius:8,border:"1px solid #ddd"}} /><select value={newPay.amountPesos} onChange={e=>setNewPay({...newPay,amountPesos:e.target.value})} style={{padding:10,borderRadius:8,border:"1px solid #ddd"}}><option value="10">P10 Test</option><option value="15">P15 Test</option><option value="99">P99</option><option value="149">P149</option></select></div>
      <button onClick={createPayment} style={{width:"100%",marginTop:10,padding:12,borderRadius:8,background:"#111",color:"#fff",border:"none",fontWeight:700}}>CREATE LINK</button>
    </div>

    {/* PAYMENTS - WITH MANUAL APPROVE BUTTONS */}
    <h3>Payments ({payments.length})</h3>
    {payments.map((p:any)=>(
      <div key={p.id} style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><b>{p.customerName} - P{(p.amountCentavos/100).toFixed(2)}</b><span style={{fontWeight:700, color: p.status==="paid"?"#2e7d32":p.status==="review"?"#ff8f00":p.status==="rejected"?"#c00":"#666"}}>{p.status.toUpperCase()}</span></div>
        <div style={{fontSize:12,color:"#666",wordBreak:"break-all"}}>ID: {p.id}<br/>Link: https://paylinks-philippines.vercel.app/pay/{p.id}</div>
        <button onClick={()=>copyLink(`https://paylinks-philippines.vercel.app/pay/${p.id}`)} style={{marginTop:8,padding:"8px 12px",borderRadius:8,border:"1px solid #ddd",background:"#fff"}}>Copy Link</button>
        {/* MANUAL APPROVE - THIS IS THE BUTTON THAT WAS MISSING */}
        {p.status!=="paid" && p.status!=="rejected" && (
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button onClick={()=>manual("approve", p)} style={{flex:1,padding:12,borderRadius:10,background:"#2e7d32",color:"#fff",border:"none",fontWeight:700,cursor:"pointer"}}>✅ Approve Manually</button>
            <button onClick={()=>manual("reject", p)} style={{flex:1,padding:12,borderRadius:10,background:"#fff",color:"#c00",border:"1px solid #fbb",fontWeight:700,cursor:"pointer"}}>❌ Reject</button>
          </div>
        )}
        {p.status==="paid" && <div style={{marginTop:8,color:"#2e7d32",fontWeight:700}}>✅ PAID - Customer can get photos</div>}
      </div>
    ))}
    {payments.length===0 && <p>No payments yet.</p>}
  </div>);
}

// rebuild-1
