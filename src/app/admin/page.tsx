"use client";
import { useEffect, useState } from "react";
export default function SuperAdmin() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", brandName:"", gcashNumber:"", gcashName:"", pin:"" });
  const [msg, setMsg] = useState("");
  async function load() {
    const res = await fetch("/api/admin/merchants");
    if (res.status===401) { window.location.href="/admin/login"; return; }
    const d = await res.json(); setMerchants(d); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);
  async function addMerchant() {
    setMsg("");
    const res = await fetch("/api/admin/merchants", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setMsg("❌ "+(d.error||"Failed")); return; }
    setMsg("✅ Merchant added: "+d.name+" | Fixed Link 99: "+d.fixedLink99);
    setForm({ name:"", brandName:"", gcashNumber:"", gcashName:"", pin:"" }); setShowAdd(false); load();
  }
  async function delMerchant(id:string, name:string) {
    if (!confirm(`DELETE merchant ${name}? This deletes ALL their payments too. Are you sure?`)) return;
    const res = await fetch(`/api/admin/merchants/${id}`, { method:"DELETE" });
    if (!res.ok) { alert("Delete failed"); return; }
    load();
  }
  async function toggleActive(id:string, current:boolean) {
    await fetch(`/api/admin/merchants/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ isActive: !current }) });
    load();
  }
  if (loading) return <div style={{padding:20}}>Loading merchants...</div>;
  return (<div style={{ maxWidth: 900, margin:"0 auto", padding:20, fontFamily:"system-ui" }}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h1>👑 Super Admin - All Merchants ({merchants.length})</h1><button onClick={()=>setShowAdd(!showAdd)} style={{padding:"10px 16px",borderRadius:10,background:"#0b6bff",color:"#fff",border:"none",fontWeight:700,cursor:"pointer"}}>{showAdd?"Cancel":"+ Add Merchant"}</button></div>
    {msg && <div style={{background:"#e8ffe8",padding:12,borderRadius:10,margin:"12px 0",wordBreak:"break-all"}}>{msg}</div>}
    {showAdd && <div style={{border:"1px solid #ddd",padding:16,borderRadius:12,margin:"12px 0",display:"grid",gap:10}}>
      <input placeholder="Store / Merchant Name - e.g. Pasko Photo Magic" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid #ddd"}} />
      <input placeholder="Brand Name (optional)" value={form.brandName} onChange={e=>setForm({...form,brandName:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid #ddd"}} />
      <input placeholder="GCash Number - 09171234567" value={form.gcashNumber} onChange={e=>setForm({...form,gcashNumber:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid #ddd"}} />
      <input placeholder="GCash Name - ANA SANTOS" value={form.gcashName} onChange={e=>setForm({...form,gcashName:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid #ddd"}} />
      <input placeholder="PIN - 1234" value={form.pin} onChange={e=>setForm({...form,pin:e.target.value})} style={{padding:12,borderRadius:8,border:"1px solid #ddd"}} />
      <button onClick={addMerchant} style={{padding:12,borderRadius:8,background:"#111",color:"#fff",border:"none",fontWeight:700,cursor:"pointer"}}>Create Merchant</button>
    </div>}
    {merchants.map((m:any)=>(
      <div key={m.id} style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><div><b style={{fontSize:18}}>{m.brandName||m.name} {m.isActive?"✅":"⛔"}</b><div style={{color:"#666",fontSize:13}}>GCash: {m.gcashNumber} | Name: {m.gcashName||"-"} | PIN: {m.pin||"-"}</div><div style={{fontSize:13}}>Total: {m.stats?.total||0} | Paid: {m.stats?.paid||0} | Pending: {m.stats?.pending||0}</div></div><div style={{display:"flex",gap:6}}><button onClick={()=>toggleActive(m.id,m.isActive)} style={{padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",cursor:"pointer"}}>{m.isActive?"Disable":"Enable"}</button><button onClick={()=>delMerchant(m.id,m.name)} style={{padding:"8px 10px",borderRadius:8,background:"#ffebeb",color:"#c00",border:"1px solid #fbb",cursor:"pointer"}}>Delete</button></div></div>
        <div style={{marginTop:10,fontSize:12,wordBreak:"break-all",background:"#f8f8f8",padding:10,borderRadius:8}}>ID: {m.id}<br/>Fixed 99: https://paylinks-philippines.vercel.app/m/{m.id}?package=99<br/>Fixed 149: https://paylinks-philippines.vercel.app/m/{m.id}?package=149<br/>Merchant Login: {m.gcashNumber} / {m.pin}</div>
      </div>
    ))}
    {merchants.length===0 && <p>No merchants yet. Click + Add Merchant.</p>}
  </div>);
}
