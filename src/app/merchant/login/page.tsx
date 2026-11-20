"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function MerchantLogin() {
  const [gcashNumber, setNum] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  async function login(e: any) {
    e.preventDefault();
    const res = await fetch("/api/merchant/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gcashNumber, pin }) });
    if (res.ok) router.push("/merchant");
    else setErr("Wrong number or PIN. Try again.");
  }
  return (
    <div style={{ maxWidth: 400, margin: "60px auto", padding: 20, fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>Merchant Login</h1>
      <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="GCash Number" value={gcashNumber} onChange={e => setNum(e.target.value)} style={{ padding: 12, fontSize: 16 }} />
        <input placeholder="PIN" type="password" value={pin} onChange={e => setPin(e.target.value)} style={{ padding: 12, fontSize: 16 }} />
        <button style={{ background: "#00A651", color: "white", padding: 14, fontSize: 18, border: "none" }}>Login</button>
      </form>
      {err && <p style={{ color: "red" }}>{err}</p>}
    </div>
  );
}
