import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { hashPassword, verifyPassword } from "../../../lib/crypto";

const COOKIE = "ironlog-uid";
const MIN_PW = 6;

function cookieOpts(req: NextRequest) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  };
}

function pwError(password: string): string | null {
  if (!password || password.length < MIN_PW)
    return `Password must be at least ${MIN_PW} characters`;
  return null;
}

function jsonRes(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── CHECK: does this username exist and what state is it in? ──────────
  if (action === "check") {
    const username = body.username?.trim().toLowerCase();
    if (!username || username.length < 2)
      return jsonRes({ error: "Username must be at least 2 characters" }, 400);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return jsonRes({ state: "new" });
    if (!user.passwordHash) return jsonRes({ state: "needs-setup" });
    return jsonRes({ state: "has-password" });
  }

  // ── REGISTER: new user ───────────────────────────────────────────────
  if (action === "register") {
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();
    const { password } = body;

    if (!username || username.length < 2)
      return jsonRes({ error: "Username must be at least 2 characters" }, 400);
    if (!email || !email.includes("@"))
      return jsonRes({ error: "Valid email required" }, 400);
    const pe = pwError(password);
    if (pe) return jsonRes({ error: pe }, 400);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing?.username === username)
      return jsonRes({ error: "Username already taken" }, 400);
    if (existing?.email === email)
      return jsonRes({ error: "Email already in use" }, 400);

    const hash = await hashPassword(password);
    const user = await prisma.user.create({ data: { username, email, passwordHash: hash } });
    const res = jsonRes({ id: user.id, username: user.username });
    res.cookies.set(COOKIE, user.id, cookieOpts(req));
    return res;
  }

  // ── SETUP: existing user (no password) sets one for the first time ───
  if (action === "setup") {
    const username = body.username?.trim().toLowerCase();
    const email = body.email?.trim().toLowerCase();
    const { password } = body;

    if (!email || !email.includes("@"))
      return jsonRes({ error: "Valid email required" }, 400);
    const pe = pwError(password);
    if (pe) return jsonRes({ error: pe }, 400);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.passwordHash)
      return jsonRes({ error: "Invalid request" }, 400);

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken && emailTaken.id !== user.id)
      return jsonRes({ error: "Email already in use" }, 400);

    const hash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, email } });

    const res = jsonRes({ id: user.id, username: user.username });
    res.cookies.set(COOKIE, user.id, cookieOpts(req));
    return res;
  }

  // ── LOGIN: existing user with password ───────────────────────────────
  if (action === "login") {
    const username = body.username?.trim().toLowerCase();
    const { password } = body;

    if (!username || !password)
      return jsonRes({ error: "Username and password required" }, 400);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash)
      return jsonRes({ error: "Invalid username or password" }, 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid)
      return jsonRes({ error: "Invalid username or password" }, 401);

    const res = jsonRes({ id: user.id, username: user.username, mustReset: user.mustResetPassword });
    res.cookies.set(COOKIE, user.id, cookieOpts(req));
    return res;
  }

  return jsonRes({ error: "Invalid action" }, 400);
}

// ── GET: check current session ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return jsonRes({ user: null });

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) {
    const res = jsonRes({ user: null });
    res.cookies.delete(COOKIE);
    return res;
  }
  return jsonRes({ user: { id: user.id, username: user.username, mustReset: user.mustResetPassword } });
}

// ── PUT: set new password (mustReset flow) ─────────────────────────────
export async function PUT(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return jsonRes({ error: "Unauthorized" }, 401);

  const { newPassword } = await req.json();
  const pe = pwError(newPassword);
  if (pe) return jsonRes({ error: pe }, 400);

  const hash = await hashPassword(newPassword);
  const user = await prisma.user.update({
    where: { id: uid },
    data: { passwordHash: hash, mustResetPassword: false },
  });
  return jsonRes({ id: user.id, username: user.username });
}

// ── DELETE: logout ─────────────────────────────────────────────────────
export async function DELETE() {
  const res = jsonRes({ success: true });
  res.cookies.delete(COOKIE);
  return res;
}
