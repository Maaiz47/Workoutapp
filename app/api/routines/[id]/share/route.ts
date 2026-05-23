import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { toUsername } = await req.json();
    if (!toUsername?.trim()) return json({ error: "Username required" }, 400);
    const handle = toUsername.trim().replace(/^@+/, "").toLowerCase();
    if (!handle) return json({ error: "Username required" }, 400);

    const [sender, routine] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { username: true, role: true, extraRoles: true } }),
      prisma.savedRoutine.findUnique({ where: { id: params.id } }),
    ]);

    if (!routine) return json({ error: "Routine not found" }, 404);
    if (routine.userId !== uid) return json({ error: "Not your routine" }, 403);
    // Power User gate. Trainers + admins are implicitly Power Users.
    // Anyone else needs to upgrade in Settings → POWER USER first.
    // (qa: power-user-role)
    const senderRoles = sender ? [sender.role, ...((sender as any).extraRoles ?? [])] : [];
    const isSenderPowerUser = senderRoles.some(r => r === "powerUser" || r === "trainer" || r === "admin");
    if (!isSenderPowerUser) {
      return json({ error: "Plan sharing is a Power User feature. Enable it free in Settings → POWER USER.", code: "POWER_USER_REQUIRED" }, 403);
    }

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
    const senderName = sender?.username ?? uid;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
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
