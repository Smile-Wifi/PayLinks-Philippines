import { prisma } from "@/lib/db";
import { formatPeso } from "@/lib/crypto";
import { notFound } from "next/navigation";
import ScreenshotUpload from "./ScreenshotUpload"; // client component

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const request = await prisma.paymentRequest.findUnique({
    where: { id },
    include: { merchant: true, payment: true },
  });

  if (!request) notFound();

  const brand = {
    name: request.merchant.brandName || request.merchant.name,
    emoji: request.merchant.brandEmoji,
    color: request.merchant.brandColor,
    footer: request.merchant.brandFooter,
  };

  if (request.status === "paid") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: "var(--okb)", color: "var(--ok)" }}
        >
          ✓
        </div>
        <h1 className="text-2xl font-extrabold">Payment successful</h1>
        <p className="mt-1 text-[var(--mute)]">
          {formatPeso(request.amountCentavos)} paid to {brand.name}
        </p>

        {request.confirmationToken && (
          <>
            <p className="mt-6 text-sm text-[var(--mute)]">Your confirmation token</p>
            <div
              className="mt-2 rounded-xl border-2 border-dashed py-3 text-xl font-bold mono tracking-wider"
              style={{
                borderColor: brand.color,
                color: brand.color,
                background: "var(--okb)",
              }}
            >
              {request.confirmationToken}
            </div>
            <p className="mt-3 text-xs text-[var(--mute)]">
              Show this token (or the QR) to the merchant staff.
            </p>
          </>
        )}

        <div className="card mt-6 text-left">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
              style={{ background: "var(--line)" }}
            >
              {brand.emoji}
            </div>
            <div>
              <b>{brand.name}</b>
              <div className="text-xs text-[var(--mute)]">
                Receipt {request.id.slice(0, 12)}… ·{" "}
                {request.paidAt?.toLocaleString()}
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--mute)]">{brand.footer}</p>
        </div>
      </div>
    );
  }

  // Pending / review / expired
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-[var(--mute)]">Pay {brand.name}</p>
      <div className="mt-2 text-4xl font-extrabold mono">
        {formatPeso(request.amountCentavos)}
      </div>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Send this <b>exact amount</b>, including the centavos
      </p>

      <div
        className="mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed text-sm text-[var(--mute)]"
        style={{ borderColor: "var(--line)" }}
      >
        Merchant GCash QR
        <br />
        (add your QR image)
      </div>

      <p className="mt-4">
        <span
          className={`chip chip-${
            request.status === "pending"
              ? "mu"
              : request.status === "review"
              ? "warn"
              : "bad"
          }`}
        >
          {request.status}
        </span>
      </p>

      {request.status === "pending" && (
        <>
          <p className="mt-4 text-xs text-[var(--mute)]">
            Paying the exact tagged amount is what confirms you.
            <br />
            No need to type a reference number.
          </p>

          {/* AI Screenshot Upload */}
          <div className="mt-8">
            <ScreenshotUpload requestId={request.id} />
          </div>
        </>
      )}

      {request.status === "review" && (
        <p className="mt-4 text-sm text-[var(--warn)]">
          Your payment is under review. Please wait a moment or contact the
          merchant.
        </p>
      )}

      {request.status === "expired" && (
        <p className="mt-4 text-sm text-[var(--warn)]">
          This request has expired. Contact the merchant if you already paid.
        </p>
      )}
    </div>
  );
}