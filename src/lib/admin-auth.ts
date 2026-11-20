import { cookies } from "next/headers";
export async function isSuperAdmin() {
  const c = await cookies();
  return c.get("super_admin")?.value === "yes";
}
export function checkSuperAdminPassword(pass: string) {
  const expected = process.env.SUPER_ADMIN_PASSWORD || "admin1234";
  return pass === expected;
}
