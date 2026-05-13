import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
    }

    const clean = username.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { username: clean } });

    if (!user) {
      user = await prisma.user.create({ data: { username: clean } });
    }

    const res = NextResponse.json({ id: user.id, username: user.username });

    res.cookies.set("ironlog-uid", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return res;
  } catch (e) {
    console.error("Auth POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("ironlog-uid")?.value;

    if (!uid) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });

    if (!user) {
      const res = NextResponse.json({ user: null });
      res.cookies.delete("ironlog-uid");
      return res;
    }

    return NextResponse.json({ user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error("Auth GET error:", e);
    return NextResponse.json({ user: null });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("ironlog-uid", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
