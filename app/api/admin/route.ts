import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// GET /api/admin — list all users
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      mustResetPassword: true,
      createdAt: true,
      _count: { select: { workoutLogs: true } },
    },
  });

  return json({ users });
}

// DELETE /api/admin — delete a user entirely
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const { userId } = await req.json();
  if (!userId) return json({ error: "Missing userId" }, 400);

  await prisma.user.delete({ where: { id: userId } });
  return json({ ok: true });
}

// PATCH /api/admin — update a user's role
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const { userId, role } = await req.json();
  if (!userId || !role) return json({ error: "Missing userId or role" }, 400);

  const validRoles = ["user", "trainer", "admin"];
  if (!validRoles.includes(role)) return json({ error: "Invalid role" }, 400);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, role: true },
  });

  return json({ user });
}
