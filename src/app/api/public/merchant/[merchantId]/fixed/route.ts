import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// For now, fixed payments are stored in Merchant brandFooter as JSON? Simpler: return from in-memory via merchant requests with label?
// We store fixed products in a separate table in full version. For this v1, we read from merchant's FixedPayment if table exists, else [].
// To keep it working without a new table, we return [] and the merchant dashboard manages fixed links via localStorage fallback in UI.
// This endpoint is kept for future DB version.
export async function GET() { return NextResponse.json([]); }
