// Admin-only endpoints for the test-user generator. All routes gated
// by ADMIN_SECRET via the x-admin-key header — same pattern as
// /api/admin and /api/qa/admin/*. (qa: test-user-generator)
//
// Cron tick is gated by EITHER admin secret OR `Authorization: Bearer
// <CRON_SECRET>` — matches Vercel cron's auth header. No public access.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  ARCHETYPES,
  SEED_ROSTER,
  TEST_USER_PASSWORD,
  advanceTestUsers,
  archetypeById,
  getAppConfigBool,
  seedTestUsers,
  setAppConfigBool,
  tickAllTestUsers,
  wipeTestUsers,
  CONFIG_KEY_SHOW_TEST_USERS,
} from "../../../../lib/testUsers";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

function isAdmin(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key");
  return !!ADMIN_SECRET && key === ADMIN_SECRET;
}

function isCron(req: NextRequest): boolean {
  const authz = req.headers.get("authorization") ?? "";
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>" automatically
  // when crons are configured with a secret in env. Locally, also allow
  // x-admin-key so manual tests work.
  if (CRON_SECRET && authz === `Bearer ${CRON_SECRET}`) return true;
  return isAdmin(req);
}

// GET /api/admin/test-users — list current test users + config toggle.
// Returns the shared password too so the admin can copy-paste creds.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);
  const users = await prisma.user.findMany({
    where: { isTestUser: true },
    select: {
      id: true,
      username: true,
      role: true,
      testArchetype: true,
      createdAt: true,
      _count: { select: { workoutLogs: true, bodyMetrics: true } },
    },
    orderBy: [{ role: "desc" }, { username: "asc" }],
  });
  const showInBoards = await getAppConfigBool(CONFIG_KEY_SHOW_TEST_USERS, false);
  return json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      archetype: u.testArchetype,
      archetypeLabel: u.testArchetype ? archetypeById(u.testArchetype)?.label ?? null : null,
      archetypeEmoji: u.testArchetype ? archetypeById(u.testArchetype)?.emoji ?? null : null,
      createdAt: u.createdAt,
      workoutCount: u._count.workoutLogs,
      bodyMetricCount: u._count.bodyMetrics,
    })),
    password: TEST_USER_PASSWORD,
    showInBoards,
    archetypes: ARCHETYPES.map(a => ({ id: a.id, label: a.label, emoji: a.emoji, description: a.description })),
    rosterSize: SEED_ROSTER.length,
  });
}

// POST /api/admin/test-users — action-based control plane. Body:
//   { action: "seed" | "wipe" | "tick" | "advance" | "set-visibility",
//     days?: number, value?: boolean }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  // The cron-triggered tick uses Bearer auth instead of admin key —
  // gate that one separately.
  if (action === "tick") {
    if (!isCron(req)) return json({ error: "Unauthorized" }, 401);
    const result = await tickAllTestUsers();
    return json({ ok: true, ...result });
  }
  // All other actions require admin secret.
  if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);
  try {
    if (action === "seed") {
      const result = await seedTestUsers();
      return json({ ok: true, ...result });
    }
    if (action === "wipe") {
      const result = await wipeTestUsers();
      return json({ ok: true, ...result });
    }
    if (action === "advance") {
      const days = Math.max(1, Math.min(180, Number(body.days) || 1));
      const result = await advanceTestUsers(days);
      return json({ ok: true, ...result });
    }
    if (action === "set-visibility") {
      const value = !!body.value;
      await setAppConfigBool(CONFIG_KEY_SHOW_TEST_USERS, value);
      return json({ ok: true, showInBoards: value });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed", stack: e?.stack }, 500);
  }
}
