"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  merchant: { name: string; brandName: string | null; brandEmoji: string; brandColor: string };
  stats: {
    collected: string;
    pending: number;
    review: number;
    expired: number;
    paid: number;
  };
  requests: Array<{
    id: string;
    customerName: string;
    amount: string;
    amountCentavos: number;
    status: string;
    expiresAt: string;
    paidAt: string | null;
    token: string | null;
    tokenConfirmedAt: string | null;
    payment: { ref: string; by: string } | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    ref: string;
    amount: string;
    sender: string | null;
    matched: boolean;
    requestId: string | null;
    createdAt: string;
  }>;
  audit: Array<{
    hash: string;
    actor: string;
    action: string;
    details: string | null;
    requestId: string | null;
    createdAt: string;
  }>;
  webhooks: Array<{
    id: string;
    requestId: string;
    event: string;
    status: string;
    signature: string;
    createdAt: string;
  }>;
};

const API_KEY_STORAGE = "pesomatch_api_key";

function statusChip(s: string) {
  const map: Record<string, string> = {
    pending: "chip-mu",
    paid: "chip-ok",
    expired: "chip-mu",
    review: "chip-warn",
    rejected: "chip-bad",
  };
  return map[s] || "chip-mu";
}

export default function MerchantDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("Mika R.");
  const [amount, setAmount] = useState("149");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenMsg, setTokenMsg] = useState("");
  const [sms, setSms] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(API_KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    [apiKey]
  );

  const load = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard", { headers: headers() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const json = await res.json();
      setData(json);
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey, headers]);

  useEffect(() => {
    if (apiKey) load();
  }, [apiKey, load]);

  async function createRequest() {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        customerName: name,
        amountPesos: Number(amount),
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || "Failed");
      return;
    }
    setSelectedId(j.id);
    await load();
  }

  async function confirmToken() {
    const res = await fetch("/api/tokens/confirm", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ token: tokenInput }),
    });
    const j = await res.json();
    setTokenMsg(j.ok ? `✓ ${j.message}` : `✕ ${j.message}`);
    if (j.ok) {
      setTokenInput("");
      await load();
    }
  }

  async function ingestSms() {
    const res = await fetch("/api/payments/ingest", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ rawSms: sms }),
    });
    const j = await res.json();
    setIngestMsg(j.message || j.error || "Done");
    setSms("");
    await load();
  }

  async function simulateExact() {
    const req = data?.requests.find((r) => r.id === selectedId && r.status === "pending");
    if (!req) {
      setIngestMsg("Select a pending request first");
      return;
    }
    const ref = String(Math.floor(1e12 + Math.random() * 9e12));
    const res = await fetch("/api/payments/ingest", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        amountCentavos: req.amountCentavos,
        gcashRef: ref,
        senderName: "MI•A R.",
      }),
    });
    const j = await res.json();
    setIngestMsg(j.message);
    await load();
  }

  async function doAction(action: "approve" | "reject") {
    if (!selectedId || !note.trim()) {
      alert("Select a request and write a note");
      return;
    }
    const res = await fetch(`/api/requests/${selectedId}/actions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action, note }),
    });
    const j = await res.json();
    if (!res.ok) alert(j.error);
    else {
      setNote("");
      await load();
    }
  }

  const selected = data?.requests.find((r) => r.id === selectedId);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)] px-5 py-3">
        <h1 className="text-lg font-bold">
          PesoMatch Gateway{" "}
          <span className="font-normal text-[var(--mute)]">
            · {data?.merchant.brandName || data?.merchant.name || "Merchant"}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <input
            className="w-64 mono text-sm"
            placeholder="pm_test_… API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="btn" onClick={load} disabled={loading || !apiKey}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1300px] p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-[var(--bad)] bg-[var(--badb)] p-3 text-[var(--bad)]">
            {error}
          </div>
        )}

        {!apiKey && (
          <div className="card mx-auto max-w-lg text-center">
            <p className="mb-2 text-lg font-semibold">Enter your merchant API key</p>
            <p className="mb-4 text-sm text-[var(--mute)]">
              Run <code className="mono">npm run db:seed</code> after setup to create a demo merchant.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Collected", data.stats.collected],
                ["Pending", data.stats.pending],
                ["Needs review", data.stats.review],
                ["Expired", data.stats.expired],
              ].map(([label, val]) => (
                <div key={label as string} className="card">
                  <div className="text-xs uppercase tracking-wide text-[var(--mute)]">{label}</div>
                  <div className="text-2xl font-extrabold">{val}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-4">
                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    New payment request
                  </h2>
                  <div className="mb-2 flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
                    <input
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <button className="btn w-full" onClick={createRequest}>
                    Create request
                  </button>
                  <p className="mt-2 text-xs text-[var(--mute)]">
                    Each request gets a unique centavo tag so one incoming payment can only match one request.
                  </p>
                </div>

                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Confirm token
                  </h2>
                  <div className="flex gap-2">
                    <input
                      className="mono"
                      placeholder="PM-XXXX-XXXX-XXXX"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                    />
                    <button className="btn btn-ok shrink-0" onClick={confirmToken}>
                      Confirm
                    </button>
                  </div>
                  {tokenMsg && <p className="mt-2 text-sm">{tokenMsg}</p>}
                </div>

                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Requests
                  </h2>
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {data.requests.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`block w-full rounded-lg border p-2.5 text-left transition ${
                          selectedId === r.id
                            ? "border-[var(--acc)] shadow-[0_0_0_1px_var(--acc)]"
                            : "border-[var(--line)]"
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="mono text-sm font-semibold">{r.id.slice(0, 12)}…</span>
                          <span className={`chip ${statusChip(r.status)}`}>{r.status}</span>
                        </div>
                        <div className="text-xs text-[var(--mute)]">
                          {r.customerName} · {r.amount}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selected && (
                  <div className="card">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                      Selected request
                    </h2>
                    <div className="text-2xl font-extrabold mono">{selected.amount}</div>
                    <div className="text-sm text-[var(--mute)]">
                      {selected.id} · {selected.customerName}
                    </div>
                    {selected.token && (
                      <p className="mt-1 text-sm">
                        Token <span className="mono font-bold">{selected.token}</span>
                        {selected.tokenConfirmedAt && " · confirmed"}
                      </p>
                    )}
                    {(selected.status === "pending" || selected.status === "review") && (
                      <>
                        <textarea
                          className="mt-3"
                          rows={2}
                          placeholder="Note (required for manual decision)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <div className="mt-2 flex gap-2">
                          <button className="btn btn-ok flex-1" onClick={() => doAction("approve")} disabled={!note.trim()}>
                            Approve
                          </button>
                          <button className="btn btn-bad flex-1" onClick={() => doAction("reject")} disabled={!note.trim()}>
                            Reject
                          </button>
                        </div>
                      </>
                    )}
                    {selected.status === "paid" && (
                      <p className="mt-2 text-sm text-[var(--ok)]">
                        Paid · checkout:{" "}
                        <a className="underline" href={`/pay/${selected.id}`} target="_blank" rel="noreferrer">
                          /pay/{selected.id.slice(0, 8)}…
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Simulate / Ingest GCash SMS
                  </h2>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button className="btn btn-ghost" onClick={simulateExact}>
                      Exact amount
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="…or paste a real GCash SMS"
                    value={sms}
                    onChange={(e) => setSms(e.target.value)}
                  />
                  <button className="btn mt-2 w-full" onClick={ingestSms}>
                    Ingest SMS
                  </button>
                  {ingestMsg && <p className="mt-2 text-sm">{ingestMsg}</p>}
                </div>

                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Payment feed
                  </h2>
                  <div className="max-h-52 space-y-2 overflow-y-auto text-sm">
                    {data.payments.length === 0 && (
                      <p className="text-[var(--mute)]">No payments received.</p>
                    )}
                    {data.payments.map((p) => (
                      <div key={p.id} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
                        <span className="mono font-semibold">{p.ref}</span> · {p.amount}
                        <div className="text-xs text-[var(--mute)]">
                          {p.sender || "—"} ·{" "}
                          {p.matched ? (
                            <span className="chip chip-ok">→ matched</span>
                          ) : (
                            <span className="chip chip-warn">unmatched</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Webhooks
                  </h2>
                  <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
                    {data.webhooks.length === 0 && (
                      <p className="text-[var(--mute)]">None yet.</p>
                    )}
                    {data.webhooks.map((w) => (
                      <div key={w.id} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
                        <b>{w.event}</b> · {w.requestId.slice(0, 10)}…
                        <div className="mono text-xs text-[var(--mute)]">sig {w.signature}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Audit trail · hash-chained
                  </h2>
                  <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
                    {data.audit.map((a) => (
                      <div key={a.hash + a.createdAt} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
                        <span className="mono text-xs text-[var(--mute)]">#{a.hash}</span>
                        <br />
                        <b>{a.requestId?.slice(0, 12) || "—"}</b> · {a.action}{" "}
                        <span className="chip chip-mu">{a.actor}</span>
                        {a.details && <span className="text-[var(--mute)]"> · {a.details}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
