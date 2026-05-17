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

// GET /api/admin — list all users (plus a separate list of pending trainer requests)
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
      roleRequest: true,
      roleRequestNote: true,
      roleRequestAt: true,
      _count: { select: { workoutLogs: true } },
    },
  });

  const trainerRequests = users
    .filter(u => u.roleRequest === "trainer")
    .map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      note: u.roleRequestNote,
      requestedAt: u.roleRequestAt,
      workoutLogs: u._count.workoutLogs,
    }))
    .sort((a, b) => (a.requestedAt && b.requestedAt) ? a.requestedAt.getTime() - b.requestedAt.getTime() : 0);

  return json({ users, trainerRequests });
}

// DELETE /api/admin — delete a user entirely
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const { userId } = await req.json();
  if (!userId) return json({ error: "Missing userId" }, 400);

  await prisma.user.delete({ where: { id: userId } });
  return json({ ok: true });
}

// PATCH /api/admin — update a user's role, or approve/reject a pending request
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const body = await req.json();
  const { userId } = body;
  if (!userId) return json({ error: "Missing userId" }, 400);

  // Approve a pending role request: promote + clear the request flags.
  if (body.action === "approve-request") {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return json({ error: "User not found" }, 404);
    if (!target.roleRequest) return json({ error: "No pending request" }, 400);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: target.roleRequest,
        roleRequest: null,
        roleRequestNote: null,
        roleRequestAt: null,
      },
      select: { id: true, username: true, role: true },
    });
    return json({ user });
  }

  // Reject a pending role request: just clear the request flags.
  if (body.action === "reject-request") {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleRequest: null, roleRequestNote: null, roleRequestAt: null },
      select: { id: true, username: true, role: true },
    });
    return json({ user });
  }

  // Direct role assignment (existing behaviour).
  const { role } = body;
  if (!role) return json({ error: "Missing role" }, 400);

  const validRoles = ["user", "trainer", "admin"];
  if (!validRoles.includes(role)) return json({ error: "Invalid role" }, 400);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, role: true },
  });

  return json({ user });
}
