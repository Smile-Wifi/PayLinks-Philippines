import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdminPassword } from "@/lib/admin-auth";
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(()=>({}));
  if (!password || !checkSuperAdminPassword(String(password))) return NextResponse.json({ error: "Wrong Super Admin password" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("super_admin", "yes", { httpOnly: true, path: "/", maxAge: 60*60*12, sameSite: "lax", secure: process.env.NODE_ENV==="production" });
  return res;
}
