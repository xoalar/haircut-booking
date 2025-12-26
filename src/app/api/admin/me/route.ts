import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, verifyAdminToken } from "@/lib/adminAuth";

export async function GET() {
  const token = (await cookies()).get(getAdminCookieName())?.value;
  const ok = token ? verifyAdminToken(token) : false;
  return NextResponse.json({ ok });
}
