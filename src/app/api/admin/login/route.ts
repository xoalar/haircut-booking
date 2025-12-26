import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminCookieName, signAdminToken } from "@/lib/adminAuth";

export async function POST(req: Request) {
  console.log("TEST_ENV:", process.env.TEST_ENV);
console.log("ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD);

  const { password } = await req.json().catch(() => ({}));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Server misconfigured (missing ADMIN_PASSWORD)." }, { status: 500 });
  }

  if (typeof password !== "string" || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const payload = `${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  const token = signAdminToken(payload);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getAdminCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
