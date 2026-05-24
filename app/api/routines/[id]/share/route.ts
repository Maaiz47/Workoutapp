import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { toUsername, toGroupId } = await req.json();
    // Accept EITHER a username (single-user share) OR a group id
    // (bulk share to every group member). (qa: routine-share-to-group)
    if (!toUsername?.trim() && !toGroupId) return json({ error: "Username or groupId required" }, 400);
    const handle = (toUsername ?? "").trim().replace(/^@+/, "").toLowerCase();

    const [sender, routine] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { username: true, role: true, extraRoles: true } }),
      prisma.savedRoutine.findUnique({ where: { id: params.id } }),
    ]);

    if (!routine) return json({ error: "Routine not found" }, 404);
    if (routine.userId !== uid) return json({ error: "Not your routine" }, 403);
    // Power User gate. 'Power User' is the trainer role, rebranded —
    // anyone (including non-coaches) can request the upgrade through
    // Settings. Admins are also implicit Power Users.
    // (qa: power-user-role)
    const senderRoles = sender ? [sender.role, ...((sender as any).extraRoles ?? [])] : [];
    const isSenderPowerUser = senderRoles.some(r => r === "trainer" || r === "admin");
    if (!isSenderPowerUser) {
      return json({ error: "Plan sharing is a Power User feature. Request the upgrade in Settings → ⚡ BECOME A POWER USER.", code: "POWER_USER_REQUIRED" }, 403);
    }

    const senderName = sender?.username ?? uid;
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    // Group share path — bulk-copy the routine to every other member
    // of a group the sender belongs to. Same per-member dedupe as the
    // single-user path. (qa: routine-share-to-group)
    if (toGroupId) {
      const groupId = String(toGroupId);
      const membership = await prisma.leaderboardGroupMember.findFirst({
        where: { groupId, userId: uid },
        select: { id: true },
      });
      if (!membership) return json({ error: "Not a member of that group" }, 403);

      const members = await prisma.leaderboardGroupMember.findMany({
        where: { groupId, userId: { not: uid } },
        select: { userId: true, user: { select: { username: true } } },
      });

      let sent = 0, deduped = 0, failed = 0;
      for (const m of members) {
        try {
          const existing = await prisma.savedRoutine.findFirst({
            where: { userId: m.userId, name: routine.name, sharedBy: senderName, createdAt: { gte: weekAgo } },
            select: { id: true },
          });
          if (existing) { deduped++; continue; }
          await prisma.savedRoutine.create({
            data: { userId: m.userId, name: routine.name, planJson: routine.planJson as any, sharedBy: senderName },
          });
          sent++;
        } catch {
          failed++;
        }
      }
      return json({ ok: true, mode: "group", sent, deduped, failed, total: members.length });
    }

    // Single-user share path (legacy / default).
    if (!handle) return json({ error: "Username required" }, 400);

    // Case-insensitive username lookup so legacy accounts (registered
    // before the auth route forced lowercase) still resolve. (qa:
    // maaiz — "Sharing saved routines don't seem to be working")
    let recipient = await prisma.user.findUnique({
      where: { username: handle },
      select: { id: true, username: true },
    });
    if (!recipient) {
      const fallback = await prisma.user.findFirst({
        where: { username: { equals: handle, mode: "insensitive" } },
        select: { id: true, username: true },
      });
      if (fallback) recipient = fallback;
    }
    if (!recipient) return json({ error: `No user @${handle}. Check the spelling.` }, 404);
    if (recipient.id === uid) return json({ error: "Can't share with yourself" }, 400);

    // Dedupe: if we shared this same routine (by name + sender) to
    // this recipient recently, don't create another copy. Saves the
    // tester from seeing duplicates after a re-send. Treats anything
    // sent in the last 7 days as "recent".
    const existing = await prisma.savedRoutine.findFirst({
      where: {
        userId: recipient.id,
        name: routine.name,
        sharedBy: senderName,
        createdAt: { gte: weekAgo },
      },
      select: { id: true },
    });
    if (existing) {
      return json({ ok: true, to: recipient.username, deduped: true });
    }

    await prisma.savedRoutine.create({
      data: {
        userId: recipient.id,
        name: routine.name,
        planJson: routine.planJson as any,
        sharedBy: senderName,
      },
    });

    return json({ ok: true, to: recipient.username });
  } catch (e: any) {
    console.error("share routine failed:", e);
    return json({ error: e?.message ?? "Share failed" }, 500);
  }
}
