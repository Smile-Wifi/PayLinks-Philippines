import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PesoMatch Gateway",
  description: "GCash payment matching with unique centavo tags",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
