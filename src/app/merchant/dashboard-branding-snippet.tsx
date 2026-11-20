// PASTE THIS INTO YOUR MERCHANT DASHBOARD PAGE - Branding Editor Section
// Put it above "Your Merchant QR" section
"use client";
import { useEffect, useState } from "react";
export function BrandingEditor() {
  const [f, setF] = useState({ brandName:"", brandEmoji:"💰", brandColor:"#0b6bff", brandFooter:"Thank you for your payment!", checkoutTitle:"", checkoutSubtitle:"", checkoutSteps:"1. Open GCash > Scan QR\n2. Amount already set - Confirm\n3. Screenshot receipt\n4. Click I Paid below" });
  const [msg, setMsg] = useState("");
  useEffect(()=>{ fetch("/api/merchant/branding").then(r=>r.json()).then(d=>{ if(!d.error) setF((p)=>({...p, ...d, checkoutSteps: d.checkoutSteps || p.checkoutSteps})); }).catch(()=>{}); },[]);
  async function save(){ setMsg("Saving..."); const r=await fetch("/api/merchant/branding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)}); const d=await r.json(); setMsg(d.message||d.error||"Saved"); }
  return (<div style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginBottom:16}}>
    <h3>🎨 Design Your Pay Page - Edit Text & Color</h3>
    <p style={{fontSize:12,color:"#666"}}>Merchant edits this - changes show instantly on your /pay/xxx page for customers.</p>
    <label>Store Name</label><input value={f.brandName} onChange={e=>setF({...f,brandName:e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} placeholder="Pasko Photo Magic" />
    <label>Emoji</label><input value={f.brandEmoji} onChange={e=>setF({...f,brandEmoji:e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} />
    <label>Brand Color</label><input type="color" value={f.brandColor} onChange={e=>setF({...f,brandColor:e.target.value})} style={{width:"100%",height:40,marginBottom:8}} />
    <label>Pay Page Title (e.g. Premium - P149)</label><input value={f.checkoutTitle} onChange={e=>setF({...f,checkoutTitle:e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} />
    <label>Pay Page Subtitle (e.g. Pay EXACTLY P149.00)</label><input value={f.checkoutSubtitle} onChange={e=>setF({...f,checkoutSubtitle:e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} />
    <label>Steps - One per line</label><textarea value={f.checkoutSteps} onChange={e=>setF({...f,checkoutSteps:e.target.value})} rows={4} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} />
    <label>Footer Thank You Text</label><input value={f.brandFooter} onChange={e=>setF({...f,brandFooter:e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #ddd",marginBottom:8}} />
    <button onClick={save} style={{padding:"12px 20px",borderRadius:10,background:f.brandColor,color:"#fff",border:"none",fontWeight:700,cursor:"pointer"}}>Save Design</button>
    {msg && <p style={{fontSize:13}}>{msg}</p>}
    <div style={{marginTop:12,padding:12,borderRadius:8,background:"#f8f8f8"}}><b>Preview:</b><div style={{fontSize:18}}>{f.brandEmoji} {f.brandName||"Your Store"}</div><div>{f.checkoutTitle||"Premium - P149"}</div><div style={{fontSize:13,color:"#666"}}>{f.checkoutSubtitle||"Pay EXACTLY"}</div></div>
  </div>);
}
