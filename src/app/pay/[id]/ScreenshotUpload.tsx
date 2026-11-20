"use client";

import { useState, useRef } from "react";

export default function ScreenshotUpload({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "review" | "error">(
    "idle"
  );
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;

    setLoading(true);
    setMessage("Reading your receipt with AI…");
    setStatus("idle");

    const form = new FormData();
    form.append("requestId", requestId);
    form.append("screenshot", file);

    try {
      const res = await fetch("/api/payments/validate-screenshot", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong");
        return;
      }

      if (data.status === "paid") {
        setStatus("success");
        setMessage(data.message || "Payment verified!");
        // Reload to show the success / token page
        setTimeout(() => window.location.reload(), 1200);
      } else if (data.status === "review") {
        setStatus("review");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.message || "Could not verify. Please try again.");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card text-left">
      <h3 className="mb-1 text-sm font-bold">Already paid?</h3>
      <p className="mb-3 text-xs text-[var(--mute)]">
        Upload your GCash receipt screenshot. AI will verify it automatically.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <button
        className="btn w-full"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Verifying…" : "Upload GCash Screenshot"}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "success"
              ? "text-[var(--ok)]"
              : status === "review"
              ? "text-[var(--warn)]"
              : status === "error"
              ? "text-[var(--bad)]"
              : "text-[var(--mute)]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}