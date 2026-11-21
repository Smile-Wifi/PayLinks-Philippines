"use client";
import React, { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Store, KeyRound, Webhook, ShieldCheck, CreditCard, TriangleAlert, Copy, Check, Eye, EyeOff, RefreshCw, QrCode, Save, BadgeCheck, X, ChevronRight, Landmark, Zap, Clock, Lock, Link2, Plus, Trash2 } from "lucide-react";

type ToastKind = "ok" | "warn" | "error";
type Toast = { text: string; kind: ToastKind } | null;
type Rotation = { id: string; kind: string; last4: string; dateLabel: string; created_at?: string };
type Payment = { id: string; name: string; amount: string; method: string; time: string; status: "PAID" | "PENDING" | "REJECTED" };
type PaymentLink = { id: string; name: string; amount: string; amountValue: number; link: string; note: string; status: "PAID" | "PENDING" | "REJECTED"; createdLabel: string };

const MERCHANT_ID = "cmwog39w40000l307jxiecno9";
const MERCHANT_LINK = "https://paylinks-philippines.vercel.app/m/cmwog39w40000l307jxiecno9";
const PAY_LINK_BASE = "https://paylinks-philippines.vercel.app/pay/";
const WEBHOOK_URL = "https://paylinks-philippines.vercel.app/api/payments/ingest";
const SAMPLE_PAYMENTS: Payment[] = [
  { id: "pay-1", name: "mmmm", amount: "P99.00", method: "GCash QR", time: "Today, 10:42 AM", status: "PAID" },
  { id: "pay-2", name: "meme", amount: "P99.00", method: "GCash QR", time: "Today, 10:18 AM", status: "PENDING" },
  { id: "pay-3", name: "Jorjan Lanaja 2", amount: "P99.00", method: "GCash QR", time: "Today, 09:57 AM", status: "PAID" },
  { id: "pay-4", name: "test-02", amount: "P149.00", method: "GCash QR", time: "Yesterday, 5:31 PM", status: "PAID" },
];
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "links", label: "Payment Links", icon: Link2 },
  { id: "store", label: "Store", icon: Store },
  { id: "api", label: "API Keys", icon: KeyRound },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "qr", label: "GCash QR", icon: QrCode },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "danger", label: "Danger Zone", icon: TriangleAlert },
];
const QR_PATTERN = [1,1,1,1,1,0,1,0,1,1,1, 1,0,0,0,1,1,0,1,0,0,1, 1,0,1,0,1,0,1,1,0,1,1, 1,0,1,0,1,1,0,0,1,0,1, 1,0,1,0,1,0,1,0,0,1,1, 0,1,0,1,0,1,0,1,1,0,0, 1,0,1,0,1,1,1,0,1,0,1, 0,1,0,1,0,0,1,1,0,1,0, 1,1,1,1,1,0,0,1,0,1,1, 1,0,0,0,1,1,0,1,1,0,1, 1,0,1,0,1,0,1,0,0,1,1];

async function callApi(action: string, args: Record<string, unknown>) {
  const col = args.collection as string | undefined;

  if (col === "paylinks_payment_links") {
    if (action === "records.list") {
      const res = await fetch("/api/requests", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      const rows = json.requests || json || [];
      return {
        records: rows.map((r: any) => ({
          id: r.id,
          created_at: r.createdAt,
          value: {
            paymentId: r.id,
            name: r.customerName,
            amount: `P${(r.amountCentavos / 100).toFixed(2)}`,
            amountValue: r.amountCentavos / 100,
            link: `${PAY_LINK_BASE}${r.id}`,
            note: "",
            status: r.status === "paid" ? "PAID" : r.status === "rejected" ? "REJECTED" : "PENDING",
            createdLabel: new Date(r.createdAt).toLocaleString("en-PH"),
          },
        })),
      };
    }
    if (action === "records.create") {
      const v = args.value as any;
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerName: v.name, amountPesos: v.amountValue }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return { id: json.id || json.request?.id || v.paymentId };
    }
    if (action === "records.replace") {
      const v = args.value as any;
      const res = await fetch(`/api/merchant/requests/${v.paymentId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: v.status === "PAID" ? "approve" : "reject", note: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return { id: args.id };
    }
    if (action === "records.delete") {
      const res = await fetch(`/api/requests/${args.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return { id: args.id };
    }
  }

  if (col === "paylinks_settings") {
    if (action === "records.list") {
      const [meRes, brandRes] = await Promise.all([
        fetch("/api/merchant/me", { cache: "no-store" }),
        fetch("/api/merchant/branding", { cache: "no-store" }),
      ]);
      if (meRes.status === 401) throw new Error("unauthorized");
      const me = await meRes.json().catch(() => ({}));
      const brand = await brandRes.json().catch(() => ({}));
      return {
        records: [{
          id: me.id || "me",
          value: {
            storeName: brand.brandName || me.brandName || me.name || "",
            gcashName: me.gcashName || "",
            gcashNumber: me.gcashNumber || "",
            amount99: true,
            amount149: true,
            pinApprove: true,
            pinRefund: true,
          },
        }],
      };
    }
    if (action === "records.replace" || action === "records.create") {
      const v = args.value as any;
      const res = await fetch("/api/merchant/branding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: v.storeName,
          brandEmoji: "🎄",
          brandColor: "#d32f2f",
          brandFooter: "Thank you for your payment!",
          checkoutTitle: "",
          checkoutSubtitle: "",
          checkoutSteps: "1. Open GCash > Scan QR\n2. Amount already set - Confirm\n3. Screenshot receipt\n4. Click I Paid below",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return { id: args.id || "me" };
    }
  }

  if (col === "paylinks_rotations") {
    if (action === "records.list") return { records: [] };
    if (action === "records.create") return { id: `rot-${Date.now()}` };
  }

  if (col === "paylinks_payment_status") {
    if (action === "records.list") return { records: [] };
    if (action === "records.create" || action === "records.replace") {
      const v = args.value as any;
      const res = await fetch(`/api/merchant/requests/${v.paymentId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: v.status === "PAID" ? "approve" : "reject", note: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return { id: args.id || v.paymentId };
    }
  }

  throw new Error(`Unmapped action: ${action} / ${col || "(no collection)"}`);
}
function makeDemoKey(prefix: string) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${out}`;
}
function nowLabel() { return new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + " · " + new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }); }

export default function App() {
  const [active, setActive] = useState("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [backendOk, setBackendOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("Pasko Photo Magic");
  const [gcashName, setGcashName] = useState("Jorjan Lanaja");
  const [gcashNumber, setGcashNumber] = useState("09752765499");
  const [showNumber, setShowNumber] = useState(false);
  const [amount99, setAmount99] = useState(true);
  const [amount149, setAmount149] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("pk_demo_8f3k2m9q1z7x4c6v9a2d");
  const [showApi, setShowApi] = useState(false);
  const [apiRotated, setApiRotated] = useState("Not rotated yet");
  const [webhookSecret, setWebhookSecret] = useState("whsec_demo_4k9m2q8x1z6c3v7b");
  const [showSecret, setShowSecret] = useState(false);
  const [secretRotated, setSecretRotated] = useState("Not rotated yet");
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [rotateTarget, setRotateTarget] = useState<"api" | "webhook" | "all" | null>(null);
  const [newKey, setNewKey] = useState<{ label: string; value: string; note: string } | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [webhookTest, setWebhookTest] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [pinApprove, setPinApprove] = useState(true);
  const [pinRefund, setPinRefund] = useState(true);
  const [qrFile99, setQrFile99] = useState("");
  const [qrFile149, setQrFile149] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(99);
  const [customAmount, setCustomAmount] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkError, setLinkError] = useState("");
  const [createdLinks, setCreatedLinks] = useState<PaymentLink[]>([]);
  const [linkRecordIds, setLinkRecordIds] = useState<Record<string, string>>({});
  const [lastCreated, setLastCreated] = useState<PaymentLink | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [clearingLinks, setClearingLinks] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overrideIds, setOverrideIds] = useState<Record<string, string>>({});
  const [showQr, setShowQr] = useState(false);
  const [regenResult, setRegenResult] = useState<{ saved: number; remaining: number; error: string | null; reloadError: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const maskedNumber = useMemo(() => gcashNumber.length >= 7 ? `${gcashNumber.slice(0, 4)}•••••${gcashNumber.slice(-2)}` : gcashNumber, [gcashNumber]);
  const payments = useMemo(() => {
    const links = createdLinks.map(l => ({ id: l.id, name: l.name, amount: l.amount, method: "Payment Link", time: l.createdLabel, status: l.status }));
    return [...links, ...SAMPLE_PAYMENTS.map(p => ({ ...p, status: (overrides[p.id] as Payment["status"]) || p.status }))];
  }, [createdLinks, overrides]);

  function flash(text: string, kind: ToastKind = "ok") { setToast({ text, kind }); window.setTimeout(() => setToast(null), 3200); }
  function copyText(text: string, label: string) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); flash(`${label} Copied!`); } catch { flash("Copy not available in this preview", "warn"); } finally { ta.remove(); }
  }
  async function reloadRecords() {
    const [s, r, p, l] = await Promise.all([
      callApi("records.list", { collection: "paylinks_settings" }),
      callApi("records.list", { collection: "paylinks_rotations" }),
      callApi("records.list", { collection: "paylinks_payment_status" }),
      callApi("records.list", { collection: "paylinks_payment_links" }),
    ]);
    const first = s?.records?.[0];
    if (first) {
      setSettingsId(first.id); const v = first.value || {};
      if (v.storeName) setStoreName(v.storeName); if (v.gcashName) setGcashName(v.gcashName); if (v.gcashNumber) setGcashNumber(v.gcashNumber);
      if (typeof v.amount99 === "boolean") setAmount99(v.amount99); if (typeof v.amount149 === "boolean") setAmount149(v.amount149);
      if (typeof v.pinApprove === "boolean") setPinApprove(v.pinApprove); if (typeof v.pinRefund === "boolean") setPinRefund(v.pinRefund);
      if (v.apiRotated) setApiRotated(v.apiRotated); if (v.secretRotated) setSecretRotated(v.secretRotated);
      if (v.apiLast4) setApiKey(`pk_demo_${"•".repeat(12)}${v.apiLast4}`);
      if (v.secretLast4) setWebhookSecret(`whsec_demo_${"•".repeat(10)}${v.secretLast4}`);
    }
    setRotations((r?.records || []).map((x: any) => ({ id: x.id, kind: x.value?.kind || "api", last4: x.value?.last4 || "—", dateLabel: x.value?.dateLabel || x.created_at || "" })));
    const ov: Record<string, string> = {}; const ids: Record<string, string> = {};
    (p?.records || []).forEach((x: any) => { if (x.value?.paymentId) { ov[x.value.paymentId] = x.value.status; ids[x.value.paymentId] = x.id; } });
    setOverrides(ov); setOverrideIds(ids);
    const linkList: PaymentLink[] = (l?.records || []).map((x: any) => ({ id: x.value?.paymentId || x.id, name: x.value?.name || "Customer", amount: x.value?.amount || "P0.00", amountValue: Number(x.value?.amountValue) || 0, link: x.value?.link || "", note: x.value?.note || "", status: (x.value?.status as PaymentLink["status"]) || "PENDING", createdLabel: x.value?.createdLabel || x.created_at || "" }));
    const linkIds: Record<string, string> = {};
    (l?.records || []).forEach((x: any) => { if (x.value?.paymentId) linkIds[x.value.paymentId] = x.id; });
    setCreatedLinks(linkList.slice().reverse());
    setLinkRecordIds(linkIds);
  }
  useEffect(() => {
    reloadRecords()
      .catch((e) => {
        if (e instanceof Error && e.message === "unauthorized") {
          window.location.href = "/merchant/login";
        } else {
          setBackendOk(false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function go(id: string) { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }

  async function saveSettings() {
    setSaving(true);
    const value = { storeName, gcashName, gcashNumber, amount99, amount149, pinApprove, pinRefund, apiRotated, secretRotated, merchantId: MERCHANT_ID, updatedAt: new Date().toISOString() };
    try {
      if (settingsId) await callApi("records.replace", { collection: "paylinks_settings", id: settingsId, value });
      else { const created = await callApi("records.create", { collection: "paylinks_settings", value, idempotency_key: `settings-${MERCHANT_ID}` }); setSettingsId(created?.id || null); }
      setBackendOk(true); flash("Store settings saved");
    } catch (e) { setBackendOk(false); flash("Backend unavailable — changes shown in this view only", "warn"); }
    setSaving(false);
  }

  async function persistRotation(kind: string, key: string, dateLabel: string) {
    const last4 = key.slice(-4);
    await callApi("records.create", { collection: "paylinks_rotations", value: { kind, last4, dateLabel, merchantId: MERCHANT_ID }, idempotency_key: `rotation-${kind}-${last4}-${Date.now()}` });
    return last4;
  }
  async function confirmRotate() {
    if (!rotateTarget) return; setRotating(true); setRotateError(null); setRegenResult(null);
    const dateLabel = nowLabel();
    try {
      if (rotateTarget === "api" || rotateTarget === "all") {
        const key = makeDemoKey("pk_demo_"); await persistRotation("API key", key, dateLabel);
        setApiKey(key); setApiRotated(dateLabel); setNewKey({ label: "New Merchant API Key", value: key, note: "Update Vercel PAYLINKS_API_KEY and redeploy." });
      }
      if (rotateTarget === "webhook" || rotateTarget === "all") {
        const key = makeDemoKey("whsec_demo_"); await persistRotation("Webhook secret", key, dateLabel);
        setWebhookSecret(key); setSecretRotated(dateLabel);
        if (rotateTarget === "webhook") setNewKey({ label: "New Webhook Secret", value: key, note: "Update Vercel PAYLINKS_WEBHOOK_SECRET and redeploy." });
        else setNewKey({ label: "New credentials generated", value: `${apiKey.slice(0, 8)}… / ${key}`, note: "Update both Vercel variables and redeploy. The API key is shown in full in the API Keys section." });
      }
      await reloadRecords().catch(() => {});
      setBackendOk(true); setRotateTarget(null);
    } catch (e) {
      setRotateError(e instanceof Error ? e.message : "Rotation could not be saved.");
      if (rotateTarget === "api") { const key = makeDemoKey("pk_demo_"); setApiKey(key); setApiRotated(dateLabel); setNewKey({ label: "New Merchant API Key (demo view only)", value: key, note: "Backend unavailable — this key was not saved. Update Vercel PAYLINKS_API_KEY and redeploy." }); setRotateTarget(null); }
      else if (rotateTarget === "webhook") { const key = makeDemoKey("whsec_demo_"); setWebhookSecret(key); setSecretRotated(dateLabel); setNewKey({ label: "New Webhook Secret (demo view only)", value: key, note: "Backend unavailable — this secret was not saved." }); setRotateTarget(null); }
      else { setBackendOk(false); flash("Backend unavailable — credentials not saved", "error"); }
    }
    setRotating(false);
  }

  async function regenerateAll() {
    setBusy(true); setRegenResult(null); setRotateError(null);
    const rows = [
      { kind: "API key", key: makeDemoKey("pk_demo_"), keyName: `regenerate-api-${Date.now()}` },
      { kind: "Webhook secret", key: makeDemoKey("whsec_demo_"), keyName: `regenerate-webhook-${Date.now()}` },
    ];
    const createRow = async (row: typeof rows[number]) => { await callApi("records.create", { collection: "paylinks_rotations", value: { kind: row.kind, last4: row.key.slice(-4), dateLabel: nowLabel(), merchantId: MERCHANT_ID }, idempotency_key: row.keyName }); };
    let saved = 0; let error: string | null = null;
    try { for (const row of rows) { await createRow(row); saved += 1; } } catch (e) { error = e instanceof Error ? e.message : String(e); }
    let reloadError: string | null = null;
    try { await reloadRecords(); } catch (e) { reloadError = e instanceof Error ? e.message : String(e); }
    setRegenResult({ saved, remaining: rows.length - saved, error, reloadError }); setBusy(false);
    if (saved === rows.length) { setApiKey(rows[0].key); setWebhookSecret(rows[1].key); setApiRotated(nowLabel()); setSecretRotated(nowLabel()); setNewKey({ label: "All credentials regenerated", value: rows[0].key, note: "API key shown in full. Update Vercel PAYLINKS_API_KEY and PAYLINKS_WEBHOOK_SECRET, then redeploy." }); flash("All credentials regenerated"); }
    else if (saved > 0) flash(`Partial save: ${saved} saved, ${rows.length - saved} remaining`, "warn");
    else flash("Backend unavailable — credentials not saved", "error");
  }

  function savePin() {
    setPinError(""); setPinSaved(false);
    if (!/^\d{4,6}$/.test(currentPin) || !/^\d{4,6}$/.test(newPin) || !/^\d{4,6}$/.test(confirmPin)) { setPinError("PINs must be 4–6 digits."); return; }
    if (newPin === currentPin) { setPinError("New PIN must be different from the current PIN."); return; }
    if (newPin !== confirmPin) { setPinError("New PIN and confirmation do not match."); return; }
    setPinSaved(true); setCurrentPin(""); setNewPin(""); setConfirmPin(""); flash("Merchant PIN updated");
  }
  async function setPayment(id: string, status: "PAID" | "REJECTED") {
    const prev = overrides[id]; setOverrides(o => ({ ...o, [id]: status }));
    try {
      if (overrideIds[id]) await callApi("records.replace", { collection: "paylinks_payment_status", id: overrideIds[id], value: { paymentId: id, status } });
      else { const created = await callApi("records.create", { collection: "paylinks_payment_status", value: { paymentId: id, status }, idempotency_key: `payment-${id}` }); setOverrideIds(o => ({ ...o, [id]: created?.id })); }
      flash(status === "PAID" ? "Payment approved" : "Payment rejected");
    } catch { setBackendOk(false); flash("Backend unavailable — status shown in this view only", "warn"); if (prev) setOverrides(o => ({ ...o, [id]: prev })); }
  }

  function copyPaymentLink(link: PaymentLink) {
    copyText(link.link, "Payment link");
    setCopiedLinkId(link.id);
    window.setTimeout(() => setCopiedLinkId(c => c === link.id ? null : c), 2000);
  }
  async function createPaymentLink() {
    const amount = selectedAmount ?? Number(customAmount);
    if (!customerName.trim()) { setLinkError("Enter a customer name to create a payment link."); return; }
    if (!amount || amount <= 0) { setLinkError("Choose an amount or enter a custom amount greater than 0."); return; }
    setLinkError(""); setCreatingLink(true);
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let rand = "";
    for (let i = 0; i < 16; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    const id = `cmwp${rand}`;
    const link = `${PAY_LINK_BASE}${id}`;
    const createdLabel = nowLabel();
    const value = { paymentId: id, name: customerName.trim(), amount: `P${amount.toFixed(2)}`, amountValue: amount, link, note: linkNote.trim(), status: "PENDING", createdLabel, merchantId: MERCHANT_ID };
    try {
      const created = await callApi("records.create", { collection: "paylinks_payment_links", value, idempotency_key: `payment-link-${id}` });
      if (created?.id) setLinkRecordIds(o => ({ ...o, [id]: created.id }));
      const newLink: PaymentLink = { id, name: value.name, amount: value.amount, amountValue: amount, link, note: value.note, status: "PENDING", createdLabel };
      setCreatedLinks(prev => [newLink, ...prev]);
      setLastCreated(newLink);
      setCustomerName(""); setLinkNote("");
      setBackendOk(true); flash("Payment link created");
    } catch (e) {
      setBackendOk(false); setLinkError(e instanceof Error ? e.message : "Payment link could not be saved. Try again.");
    }
    setCreatingLink(false);
  }
  async function setLinkStatus(id: string, status: PaymentLink["status"]) {
    const prev = createdLinks.find(l => l.id === id);
    if (!prev) return;
    setCreatedLinks(list => list.map(l => l.id === id ? { ...l, status } : l));
    if (lastCreated?.id === id) setLastCreated({ ...lastCreated, status });
    try {
      const value = { paymentId: prev.id, name: prev.name, amount: prev.amount, amountValue: prev.amountValue, link: prev.link, note: prev.note, status, createdLabel: prev.createdLabel, merchantId: MERCHANT_ID };
      if (linkRecordIds[id]) await callApi("records.replace", { collection: "paylinks_payment_links", id: linkRecordIds[id], value });
      else {
        const created = await callApi("records.create", { collection: "paylinks_payment_links", value, idempotency_key: `payment-link-${id}` });
        if (created?.id) setLinkRecordIds(o => ({ ...o, [id]: created.id }));
      }
      flash(status === "PAID" ? "Payment link approved" : "Payment link rejected");
    } catch {
      setBackendOk(false);
      setCreatedLinks(list => list.map(l => l.id === id ? { ...l, status: prev.status } : l));
      if (lastCreated?.id === id) setLastCreated({ ...lastCreated, status: prev.status });
      flash("Backend unavailable — status not saved", "warn");
    }
  }
  function handlePaymentAction(id: string, status: "PAID" | "REJECTED") {
    if (createdLinks.some(l => l.id === id)) setLinkStatus(id, status);
    else setPayment(id, status);
  }
  async function clearHistory() {
    setClearingLinks(true);
    try {
      for (const l of createdLinks) {
        const recordId = linkRecordIds[l.id];
        if (recordId) await callApi("records.delete", { collection: "paylinks_payment_links", id: recordId });
      }
      setCreatedLinks([]); setLinkRecordIds({}); setLastCreated(null); setConfirmClear(false); flash("Payment link history cleared");
    } catch {
      setBackendOk(false); flash("Backend unavailable — history not cleared", "warn");
      try { await reloadRecords(); } catch {}
    }
    setClearingLinks(false);
  }

  const sectionTitle = (kicker: string, title: string, sub: string) => (
    <div className="mb-4"><p className="text-[11px] font-extrabold tracking-[0.18em] uppercase" style={{ color: "var(--primary)" }}>{kicker}</p><h2 className="text-xl font-extrabold mt-1">{title}</h2><p className="text-sm" style={{ color: "var(--muted)" }}>{sub}</p></div>
  );

  return (
    <div data-safe-area-inset-root style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)", minHeight: "100vh", background: "var(--surface)" }}>
      <header data-safe-area-sticky-top style={{ top: "var(--safe-area-inset-top)", position: "sticky", zIndex: 30, background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ background: "var(--primary)" }}>P</div>
          <div className="min-w-0"><p className="font-extrabold leading-tight truncate">PayLinks <span style={{ color: "var(--primary)" }}>Merchant</span></p><p className="text-xs truncate" style={{ color: "var(--muted)" }}>Pasko Photo Magic · Demo settings</p></div>
          <div className="ml-auto flex items-center gap-2"><span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}><span className="w-2 h-2 rounded-full bg-[var(--primary)]" />Live</span><span className="hidden sm:inline-flex chip" style={{ background: "var(--surface-3)" }}>DEMO · No real secrets</span></div>
        </div>
        <nav className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar lg:hidden">{NAV.map(n => <button key={n.id} onClick={() => go(n.id)} className={`btn btn-ghost whitespace-nowrap !py-2 !px-3 text-sm ${active === n.id ? "!bg-[var(--primary-soft)] !text-[var(--primary-dark)] !border-[var(--primary)]" : ""}`}><n.icon size={16} />{n.label}</button>)}</nav>
      </header>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 lg:py-7 flex gap-6 items-start">
        <aside className="hidden lg:block w-[248px] shrink-0 sticky" style={{ top: "calc(var(--safe-area-inset-top) + 84px)" }}>
          <div className="card p-3"><p className="px-2 pt-1 pb-2 text-[11px] font-extrabold tracking-widest" style={{ color: "var(--muted)" }}>MERCHANT MENU</p>{NAV.map(n => <button key={n.id} onClick={() => go(n.id)} className={`navbtn ${active === n.id ? "active" : ""}`}><n.icon size={18} />{n.label}<ChevronRight size={15} className="ml-auto opacity-40" /></button>)}</div>
          <div className="card p-4 mt-4" style={{ background: "var(--primary-soft)", borderColor: "var(--line)" }}><div className="flex items-center gap-2 font-extrabold text-[var(--primary-dark)]"><Zap size={18} />Fast checkout</div><p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Customers scan your GCash QR and you approve the payment here.</p><p className="mono text-xs mt-3 break-all" style={{ color: "var(--primary-dark)" }}>{MERCHANT_LINK}</p></div>
        </aside>

        <main className="flex-1 min-w-0 space-y-8">
          {!backendOk && <div className="card p-4 flex gap-3 items-start" style={{ background: "var(--amber-soft)" }}><TriangleAlert className="text-[var(--amber)] shrink-0" /><p className="text-sm"><b>Backend unavailable.</b> This demo still lets you try every control, but changes are shown in this view only until the records service is reachable.</p></div>}
          {loading && <p className="text-sm" style={{ color: "var(--muted)" }}>Loading saved merchant settings…</p>}

          <section id="overview" className="scroll-mt-28">
            <div className="card overflow-hidden"><div className="p-5 sm:p-6" style={{ background: "linear-gradient(120deg, var(--primary), #0b6b48)", color: "#fff" }}>
              <div className="flex flex-wrap gap-4 items-start justify-between"><div><p className="text-xs font-bold opacity-80 tracking-widest">MERCHANT OVERVIEW</p><h1 className="text-[clamp(1.8rem,5vw,2.8rem)] font-black leading-tight mt-1 [overflow-wrap:anywhere]">{storeName}</h1><p className="opacity-90 text-sm mt-1">GCash: {gcashName} · {maskedNumber}</p></div><span className="chip bg-white text-emerald-800"><BadgeCheck size={15} />Live</span></div>
              <div className="grid sm:grid-cols-3 gap-3 mt-5"><div className="rounded-2xl bg-white/15 p-4"><p className="text-xs opacity-80">Today Paid</p><p className="text-3xl font-black mt-1">P99.00</p><p className="text-xs opacity-80 mt-1">1 confirmed payment</p></div><div className="rounded-2xl bg-white/15 p-4 sm:col-span-2"><p className="text-xs opacity-80">Merchant ID</p><p className="mono text-sm font-semibold break-all mt-1 [overflow-wrap:anywhere]">{MERCHANT_ID}</p><button onClick={() => copyText(MERCHANT_ID, "Merchant ID")} className="btn bg-white text-emerald-800 mt-3 !py-2 text-sm"><Copy size={15} />Copy Merchant ID</button></div></div>
              <div className="flex flex-wrap gap-2 mt-4"><button onClick={() => copyText(MERCHANT_LINK, "Merchant link")} className="btn bg-white text-emerald-800 !py-2.5 text-sm"><Copy size={16} />Copy Link</button><button onClick={() => setShowQr(true)} className="btn border-white/50 text-white !py-2.5 text-sm"><QrCode size={16} />Show Merchant QR</button><span className="text-xs self-center opacity-80 ml-1">Share this link with customers at checkout.</span></div>
            </div><div className="p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm"><span><b>Store:</b> {storeName}</span><span><b>GCash:</b> {gcashName}</span><span className="flex items-center gap-1"><Clock size={15} /> Updated today</span></div></div>
          </section>

          <section id="links" className="scroll-mt-28">{sectionTitle("Payment Links", "Create Payment Link", "Generate a shareable checkout link for one customer. It appears at the top of Payments for manual approval.")}
            <div className="card p-5 sm:p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block"><span className="text-sm font-bold">Customer Name</span><input className="field mt-2" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Juan Dela Cruz / test-01" /></label>
                <label className="block"><span className="text-sm font-bold">Merchant ID</span><input className="field mt-2 mono !text-sm" value={MERCHANT_ID} readOnly /></label>
              </div>
              <div>
                <p className="text-sm font-bold mb-3">Amount</p>
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 99, 149].map(amt => <button key={amt} type="button" onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }} className={`btn ${selectedAmount === amt ? "btn-primary" : "btn-ghost"}`}>P{amt}{amt <= 15 ? " Test" : ""}</button>)}
                </div>
                <label className="block mt-3"><span className="text-sm font-bold">Custom Amount</span><div className="flex items-center gap-2 mt-2"><span className="font-extrabold">P</span><input className="field mono" inputMode="decimal" value={customAmount} onChange={e => { setCustomAmount(e.target.value.replace(/[^0-9.]/g, "")); setSelectedAmount(null); }} placeholder="0.00" /></div></label>
                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Selected amount: <b style={{ color: "var(--ink)" }}>P{((selectedAmount ?? Number(customAmount)) || 0).toFixed(2)}</b></p>
              </div>
              <label className="block"><span className="text-sm font-bold">Note <span style={{ color: "var(--muted)" }}>(optional)</span></span><input className="field mt-2" value={linkNote} onChange={e => setLinkNote(e.target.value)} placeholder="e.g. One standard photo package" /></label>
              {linkError && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{linkError}</p>}
              <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" onClick={createPaymentLink} disabled={creatingLink}><Plus size={17} />{creatingLink ? "Creating…" : "CREATE LINK"}</button><span className="text-xs" style={{ color: "var(--muted)" }}>New links start as PENDING until approved.</span></div>
              {lastCreated && <div className="rounded-2xl p-4 sm:p-5 border" style={{ background: "var(--primary-soft)", borderColor: "var(--line)" }}><div className="flex flex-wrap justify-between gap-2 items-start"><div><p className="text-xs font-extrabold tracking-widest" style={{ color: "var(--primary-dark)" }}>PAYMENT LINK CREATED</p><p className="font-extrabold text-lg mt-1 [overflow-wrap:anywhere]">{lastCreated.name} · {lastCreated.amount}</p><p className="text-xs" style={{ color: "var(--muted)" }}>Payment ID: {lastCreated.id} · {lastCreated.createdLabel}{lastCreated.note ? ` · ${lastCreated.note}` : ""}</p></div><span className="chip" style={lastCreated.status === "PAID" ? { background: "var(--primary-soft)", color: "var(--primary-dark)" } : lastCreated.status === "PENDING" ? { background: "var(--amber-soft)", color: "var(--amber)" } : { background: "var(--danger-soft)", color: "var(--danger)" }}>{lastCreated.status}</span></div><code className="mono block mt-3 p-3 rounded-xl text-sm break-all [overflow-wrap:anywhere]" style={{ background: "var(--surface-2)" }}>{lastCreated.link}</code><div className="flex flex-wrap items-center gap-3 mt-4"><button className="btn btn-primary" onClick={() => copyPaymentLink(lastCreated)}><Copy size={16} />{copiedLinkId === lastCreated.id ? "Copied!" : "Copy Link"}</button>{lastCreated.status === "PENDING" && <><button className="btn btn-ghost" onClick={() => handlePaymentAction(lastCreated.id, "PAID")}><Check size={16} />Approve</button><button className="btn btn-outline-danger" onClick={() => handlePaymentAction(lastCreated.id, "REJECTED")}><X size={16} />Reject</button></>}<div className="ml-auto text-center"><div className="w-24 mx-auto"><div className="qr-grid">{QR_PATTERN.map((c, i) => <span key={i} className={`qr-cell ${c ? "filled" : ""}`} />)}</div></div><p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>QR placeholder</p></div></div></div>}
            </div>
            <div className="card p-5 sm:p-6 mt-4">
              <div className="flex flex-wrap justify-between gap-3 items-start"><div><h3 className="font-extrabold flex items-center gap-2"><Link2 size={18} className="text-[var(--primary)]" />Created Payment Links</h3><p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{createdLinks.length === 0 ? "No payment links created yet." : `${createdLinks.length} saved link${createdLinks.length === 1 ? "" : "s"} · newest first`}</p></div>{createdLinks.length > 0 && !confirmClear && <button className="btn btn-ghost !py-2 text-sm" onClick={() => setConfirmClear(true)}><Trash2 size={15} />Clear history</button>}{confirmClear && <div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold">Clear all links?</span><button className="btn btn-danger !py-2 text-sm" onClick={clearHistory} disabled={clearingLinks}>{clearingLinks ? "Clearing…" : "Yes, clear"}</button><button className="btn btn-ghost !py-2 text-sm" onClick={() => setConfirmClear(false)}>Cancel</button></div>}</div>
              {createdLinks.length > 0 && <div className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>{createdLinks.map(l => <div key={l.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap justify-between gap-2 items-center"><p className="font-bold [overflow-wrap:anywhere]">{l.name} · {l.amount}</p><span className="chip" style={l.status === "PAID" ? { background: "var(--primary-soft)", color: "var(--primary-dark)" } : l.status === "PENDING" ? { background: "var(--amber-soft)", color: "var(--amber)" } : { background: "var(--danger-soft)", color: "var(--danger)" }}>{l.status}</span></div><p className="mono text-xs mt-1 break-all [overflow-wrap:anywhere]" style={{ color: "var(--muted)" }}>{l.link}</p><p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Created: {l.createdLabel}{l.note ? ` · Note: ${l.note}` : ""}</p><div className="flex flex-wrap gap-2 mt-3"><button className="btn btn-ghost !py-2 text-sm" onClick={() => copyPaymentLink(l)}><Copy size={15} />{copiedLinkId === l.id ? "Copied!" : "Copy"}</button>{l.status === "PENDING" ? <><button className="btn btn-primary !py-2 text-sm" onClick={() => handlePaymentAction(l.id, "PAID")}><Check size={15} />Approve</button><button className="btn btn-outline-danger !py-2 text-sm" onClick={() => handlePaymentAction(l.id, "REJECTED")}><X size={15} />Reject</button></> : <span className="text-xs self-center" style={{ color: "var(--muted)" }}>{l.status === "PAID" ? "Approved" : "Rejected"}</span>}</div></div>)}</div>}
            </div>
          </section>

          <section id="store" className="scroll-mt-28">{sectionTitle("01 · Store", "Store Settings", "This is what customers see at checkout.")}
            <div className="card p-5 sm:p-6 space-y-5"><div className="grid sm:grid-cols-2 gap-4"><label className="block"><span className="text-sm font-bold">Store Name</span><input className="field mt-2" value={storeName} onChange={e => setStoreName(e.target.value)} /></label><label className="block"><span className="text-sm font-bold">GCash Name</span><input className="field mt-2" value={gcashName} onChange={e => setGcashName(e.target.value)} /></label></div>
            <div><span className="text-sm font-bold">GCash Number</span><div className="flex gap-2 mt-2"><input className="field" value={showNumber ? gcashNumber : maskedNumber} readOnly={!showNumber} onChange={e => setGcashNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))} /><button className="btn btn-ghost" onClick={() => setShowNumber(v => !v)}>{showNumber ? <EyeOff size={17} /> : <Eye size={17} />}{showNumber ? "Hide" : "Show"}</button></div><p className="text-xs mt-2" style={{ color: "var(--muted)" }}>The number is masked in the overview. Use Show only on a private screen.</p></div>
            <div><p className="text-sm font-bold mb-3">Accepted amounts</p><div className="grid sm:grid-cols-2 gap-3"><button onClick={() => setAmount99(v => !v)} className="card !shadow-none p-4 flex items-center justify-between text-left"><span><b className="text-lg">P99</b><span className="block text-xs" style={{ color: "var(--muted)" }}>Standard photo package</span></span><span className={`toggle ${amount99 ? "on" : ""}`} /></button><button onClick={() => setAmount149(v => !v)} className="card !shadow-none p-4 flex items-center justify-between text-left"><span><b className="text-lg">P149</b><span className="block text-xs" style={{ color: "var(--muted)" }}>Premium photo package</span></span><span className={`toggle ${amount149 ? "on" : ""}`} /></button></div></div>
            <div className="flex flex-wrap items-center gap-3 pt-1"><button className="btn btn-primary" onClick={saveSettings} disabled={saving}><Save size={17} />{saving ? "Saving…" : "Save Changes"}</button><span className="text-xs" style={{ color: "var(--muted)" }}>Changes apply to the merchant checkout link.</span></div></div>
          </section>

          <section id="api" className="scroll-mt-28">{sectionTitle("02 · API Keys", "Merchant API Key", "Use this demo key only in development. Rotate it if it was ever shared.")}
            <div className="card p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold flex items-center gap-2"><KeyRound size={18} className="text-[var(--primary)]" />Live demo key</h3><p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Last rotated: <b style={{ color: "var(--ink)" }}>{apiRotated}</b></p></div><span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}>pk_demo_ •••• {apiKey.slice(-4)}</span></div>
            <div className="mt-4 p-4 rounded-xl flex flex-wrap items-center gap-3" style={{ background: "var(--surface-3)" }}><code className="mono text-sm font-semibold break-all flex-1 [overflow-wrap:anywhere]">{showApi ? apiKey : `pk_live_${"•".repeat(12)}${apiKey.slice(-4)}`}</code><button className="btn btn-ghost !py-2" onClick={() => setShowApi(v => !v)}>{showApi ? <EyeOff size={16} /> : <Eye size={16} />}{showApi ? "Hide" : "Show"}</button><button className="btn btn-ghost !py-2" onClick={() => copyText(apiKey, "API key")}><Copy size={16} />Copy</button></div>
            <div className="flex flex-wrap gap-2 mt-4"><button className="btn btn-primary" onClick={() => setRotateTarget("api")}><RefreshCw size={16} />Rotate API Key</button><p className="text-xs self-center max-w-[420px]" style={{ color: "var(--muted)" }}>Rotation is immediate. The old key stops working and must be replaced in Vercel.</p></div></div>
          </section>

          <section id="webhooks" className="scroll-mt-28">{sectionTitle("03 · Webhooks", "Webhook Secret", "PayLinks signs payment notifications with this demo secret.")}
            <div className="card p-5 sm:p-6"><label className="text-sm font-bold">Webhook URL</label><div className="flex flex-col sm:flex-row gap-2 mt-2"><input className="field mono !text-sm" value={WEBHOOK_URL} readOnly /><button className="btn btn-ghost shrink-0" onClick={() => copyText(WEBHOOK_URL, "Webhook URL")}><Copy size={16} />Copy</button></div>
            <div className="mt-5 p-4 rounded-xl flex flex-wrap items-center gap-3" style={{ background: "var(--surface-3)" }}><code className="mono text-sm font-semibold break-all flex-1 [overflow-wrap:anywhere]">{showSecret ? webhookSecret : `whsec_${"•".repeat(12)}${webhookSecret.slice(-4)}`}</code><button className="btn btn-ghost !py-2" onClick={() => setShowSecret(v => !v)}>{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}{showSecret ? "Hide" : "Show"}</button><button className="btn btn-ghost !py-2" onClick={() => copyText(webhookSecret, "Webhook secret")}><Copy size={16} />Copy</button></div><p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Last rotated: <b style={{ color: "var(--ink)" }}>{secretRotated}</b></p>
            <div className="flex flex-wrap gap-2 mt-4"><button className="btn btn-primary" onClick={() => setRotateTarget("webhook")}><RefreshCw size={16} />Rotate Secret</button><button className="btn btn-ghost" onClick={() => { setWebhookTest(`Test event accepted · ${nowLabel()} · payment_ingest.ok`); flash("Test webhook succeeded"); }}>Test Webhook</button></div>
            {webhookTest && <div className="mt-4 p-3 rounded-xl flex gap-2 text-sm" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}><Check size={18} className="shrink-0" />{webhookTest}</div>}
            </div>
          </section>

          <section id="security" className="scroll-mt-28">{sectionTitle("04 · Security", "Merchant PIN", "The PIN is validated in this demo and is never saved as a record.")}
            <div className="grid lg:grid-cols-5 gap-4"><div className="card p-5 sm:p-6 lg:col-span-3"><h3 className="font-extrabold flex items-center gap-2"><Lock size={18} />Change PIN</h3><div className="grid sm:grid-cols-3 gap-3 mt-4"><label className="block text-sm font-bold">Current PIN<input className="field mt-2 mono" inputMode="numeric" maxLength={6} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/[^0-9]/g, ""))} /></label><label className="block text-sm font-bold">New PIN<input className="field mt-2 mono" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ""))} /></label><label className="block text-sm font-bold">Confirm New PIN<input className="field mt-2 mono" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ""))} /></label></div><p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Use 4–6 digits. New PIN must differ from the current PIN.</p>{pinError && <p className="text-sm mt-3 font-semibold text-[var(--danger)]">{pinError}</p>}{pinSaved && <p className="text-sm mt-3 font-semibold text-[var(--primary)]">PIN updated for this demo session.</p>}<button className="btn btn-primary mt-4" onClick={savePin}>Save New PIN</button></div>
            <div className="card p-5 lg:col-span-2"><h3 className="font-extrabold">PIN protection</h3><div className="space-y-4 mt-4"><button onClick={() => setPinApprove(v => !v)} className="w-full flex justify-between gap-3 text-left"><span><b className="text-sm">Require PIN for manual approve</b><span className="block text-xs" style={{ color: "var(--muted)" }}>Confirm approvals with your PIN.</span></span><span className={`toggle ${pinApprove ? "on" : ""}`} /></button><button onClick={() => setPinRefund(v => !v)} className="w-full flex justify-between gap-3 text-left"><span><b className="text-sm">Require PIN for refunds</b><span className="block text-xs" style={{ color: "var(--muted)" }}>Add a PIN check before refunds.</span></span><span className={`toggle ${pinRefund ? "on" : ""}`} /></button></div><button className="btn btn-primary mt-5 w-full" onClick={saveSettings}>Save Security Settings</button></div></div>
          </section>

          <section id="qr" className="scroll-mt-28">{sectionTitle("05 · GCash QR", "GCash QR Codes", "Customers scan the amount-matched QR in the GCash app.")}
            <div className="grid sm:grid-cols-2 gap-4">{[{ amount: "P99", file: qrFile99, set: setQrFile99 }, { amount: "P149", file: qrFile149, set: setQrFile149 }].map(q => <div key={q.amount} className="card p-5"><div className="flex justify-between items-start"><div><p className="text-xs font-bold tracking-widest" style={{ color: "var(--muted)" }}>GCASH QR</p><p className="text-3xl font-black">{q.amount}</p></div><span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}><BadgeCheck size={14} />Uploaded</span></div><div className="mt-4 h-36 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-3)" }}><div className="w-28"><div className="qr-grid">{QR_PATTERN.map((c, i) => <span key={i} className={`qr-cell ${c ? "filled" : ""}`} />)}</div></div></div><p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--muted)" }}>GCash app → QR → Set amount → Save → Upload here. QR uploads are not available yet, so this demo keeps the placeholder preview.</p><div className="mt-3 flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => q.set(q.amount === "P99" ? "gcash-qr-99-demo.png" : "gcash-qr-149-demo.png")}>Use Demo QR</button><button className="btn btn-ghost" onClick={() => copyText(MERCHANT_LINK, "Merchant link")}>Copy Link</button></div>{q.file && <p className="text-xs mt-3 font-semibold text-[var(--primary)]">Selected demo file: {q.file}</p>}</div>)}</div>
          </section>

          <section id="payments" className="scroll-mt-28">{sectionTitle("06 · Payments", "Recent Payments", "New payment links appear at the top. Approve or reject payments awaiting manual review.")}
            <div className="card overflow-hidden"><div className="p-4 border-b flex justify-between" style={{ borderColor: "var(--line)" }}><b>Payment activity</b><span className="text-xs" style={{ color: "var(--muted)" }}>Sample demo data</span></div>{payments.map(p => <div key={p.id} className="p-4 sm:p-5 border-b last:border-0 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--line)" }}><div className="w-10 h-10 rounded-full flex items-center justify-center font-black" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}>{p.name.slice(0, 1).toUpperCase()}</div><div className="min-w-[130px] flex-1"><p className="font-bold [overflow-wrap:anywhere]">{p.name}</p><p className="text-xs" style={{ color: "var(--muted)" }}>{p.method} · {p.time}</p></div><b className="text-lg">{p.amount}</b><span className="chip" style={p.status === "PAID" ? { background: "var(--primary-soft)", color: "var(--primary-dark)" } : p.status === "PENDING" ? { background: "var(--amber-soft)", color: "var(--amber)" } : { background: "var(--danger-soft)", color: "var(--danger)" }}>{p.status}</span>{p.status === "PENDING" ? <div className="flex gap-2 w-full sm:w-auto"><button className="btn btn-primary flex-1 !py-2 text-sm" onClick={() => handlePaymentAction(p.id, "PAID")}><Check size={16} />Approve Manually</button><button className="btn btn-outline-danger flex-1 !py-2 text-sm" onClick={() => handlePaymentAction(p.id, "REJECTED")}><X size={16} />Reject</button></div> : <span className="text-xs w-full sm:w-auto" style={{ color: "var(--muted)" }}>{p.status === "PAID" ? "Confirmed" : "Not paid"}</span>}</div>)}</div>
          </section>

          <section id="danger" className="scroll-mt-28">{sectionTitle("07 · Danger Zone", "Danger Zone", "Irreversible credential actions. Keep a copy of new keys before closing the one-time view.")}
            <div className="card p-5 sm:p-6 !border-red-200" style={{ background: "var(--danger-soft)" }}><div className="flex flex-wrap justify-between gap-4"><div><h3 className="font-extrabold text-[var(--danger)] flex items-center gap-2"><TriangleAlert size={19} />Regenerate all credentials</h3><p className="text-sm mt-2 max-w-[560px]" style={{ color: "var(--muted)" }}>Rotates both the Merchant API Key and the Webhook Secret. Old credentials stop working immediately.</p></div><button className="btn btn-danger self-start" onClick={() => setRotateTarget("all")} disabled={busy}><RefreshCw size={17} />Regenerate All</button></div>{regenResult && <div className="mt-4 p-3 rounded-xl bg-white/70 text-sm"><b>Saved:</b> {regenResult.saved} · <b>Remaining:</b> {regenResult.remaining}{regenResult.error && <span className="block text-[var(--danger)]">{regenResult.error}</span>}{regenResult.reloadError && <span className="block">Reload: {regenResult.reloadError}</span>}</div>}</div>
            <div className="card p-5 mt-4"><h3 className="font-extrabold flex items-center gap-2"><Clock size={18} />Rotation history</h3>{rotations.length === 0 ? <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>No rotations recorded yet. Rotate a credential to add it here.</p> : <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>{rotations.slice().reverse().map(r => <li key={r.id} className="py-3 flex flex-wrap justify-between gap-2"><span><b className="text-sm">{r.kind}</b><span className="block text-xs" style={{ color: "var(--muted)" }}>{r.dateLabel}</span></span><code className="mono text-xs">•••• {r.last4}</code></li>)}</ul>}</div>
          </section>
          <footer className="pb-6 pt-2 text-xs flex flex-wrap gap-3" style={{ color: "var(--muted)" }}><span className="flex items-center gap-1"><Landmark size={14} />PayLinks demo</span><span>Merchant ID: {MERCHANT_ID}</span><span>All keys are demo placeholders.</span></footer>
        </main>
      </div>

      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-5 z-50 px-4 py-3 rounded-xl text-white font-bold text-sm shadow-xl max-w-[92vw] text-center" style={{ background: toast.kind === "error" ? "var(--danger)" : toast.kind === "warn" ? "#8a5b00" : "var(--primary)" }}>{toast.text}</div>}

      {rotateTarget && <div className="fixed inset-0 overflow-y-auto z-50 pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/55 px-4"><div className="min-h-full flex items-center justify-center"><div className="card w-full max-w-[520px] p-6"><div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><TriangleAlert /></div><h2 className="text-2xl font-black mt-4">Rotate {rotateTarget === "all" ? "all credentials" : rotateTarget === "api" ? "API Key" : "Webhook Secret"}?</h2><p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>{rotateTarget === "all" ? "Both old credentials will stop working immediately." : "The old key will stop working immediately."} Update Vercel env vars{rotateTarget === "all" ? " and redeploy." : rotateTarget === "api" ? " — PAYLINKS_API_KEY — and redeploy." : " — PAYLINKS_WEBHOOK_SECRET — and redeploy."}</p>{rotateError && <p className="text-sm mt-3 font-semibold text-[var(--danger)]">{rotateError}</p>}<div className="flex gap-2 mt-6"><button className="btn btn-ghost flex-1" onClick={() => setRotateTarget(null)}>Cancel</button><button className="btn btn-danger flex-1" disabled={rotating} onClick={rotateTarget === "all" ? () => { setRotateTarget(null); regenerateAll(); } : confirmRotate}>{rotating ? "Rotating…" : "Confirm Rotation"}</button></div></div></div></div>}

      {newKey && <div className="fixed inset-0 overflow-y-auto z-50 pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/55 px-4"><div className="min-h-full flex items-center justify-center"><div className="card w-full max-w-[560px] p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold tracking-widest" style={{ color: "var(--primary)" }}>ONE-TIME VIEW</p><h2 className="text-2xl font-black mt-1">{newKey.label}</h2></div><button className="btn btn-ghost !p-2" onClick={() => setNewKey(null)} aria-label="Close new key"><X /></button></div><div className="p-4 rounded-xl mt-4" style={{ background: "var(--amber-soft)" }}><p className="text-sm font-bold">Copy this key now. It will not be shown in full again.</p><p className="text-sm mt-1">{newKey.note}</p></div><code className="mono block mt-4 p-4 rounded-xl text-sm break-all [overflow-wrap:anywhere]" style={{ background: "var(--surface-3)" }}>{newKey.value}</code><div className="flex gap-2 mt-5"><button className="btn btn-primary flex-1" onClick={() => copyText(newKey.value, "New key")}><Copy size={16} />Copy New Key</button><button className="btn btn-ghost flex-1" onClick={() => setNewKey(null)}>I’ve Saved It</button></div></div></div></div>}

      {showQr && <div className="fixed inset-0 overflow-y-auto z-50 pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/55 px-4"><div className="min-h-full flex items-center justify-center"><div className="card w-full max-w-[420px] p-6 text-center"><div className="flex justify-between items-center"><h2 className="font-black text-xl">Merchant QR</h2><button className="btn btn-ghost !p-2" onClick={() => setShowQr(false)} aria-label="Close QR"><X /></button></div><div className="w-56 mx-auto mt-5 p-3 rounded-2xl border" style={{ borderColor: "var(--line)" }}><div className="qr-grid">{QR_PATTERN.map((c, i) => <span key={i} className={`qr-cell ${c ? "filled" : ""}`} />)}</div></div><p className="font-extrabold mt-4">{storeName}</p><p className="text-xs break-all [overflow-wrap:anywhere]" style={{ color: "var(--muted)" }}>{MERCHANT_LINK}</p><p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Demo QR preview. Use Copy Link to share the live merchant link.</p><button className="btn btn-primary w-full mt-4" onClick={() => { copyText(MERCHANT_LINK, "Merchant link"); setShowQr(false); }}><Copy size={16} />Copy Merchant Link</button></div></div></div>}
    </div>
  );
}