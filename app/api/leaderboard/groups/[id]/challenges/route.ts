import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// Allowed challenge metrics — mirrors lib/challenges.ts but typed here
// so the API doesn't depend on the client catalogue.
const METRICS = new Set(["total_reps", "total_sessions", "total_volume_kg", "exercise_distinct"]);

// Walk every member's WorkoutLog rows in the challenge window and
// total the metric. Returns both the shared total and a per-member
// breakdown so the UI can render a "your contribution" row.
async function computeProgress(challenge: {
  groupId: string;
  metric: string;
  startedAt: Date;
  endsAt: Date;
  exerciseSubstrings: string | null;
}): Promise<{ total: number; perMember: Record<string, number> }> {
  const members = await prisma.leaderboardGroupMember.findMany({
    where: { groupId: challenge.groupId },
    select: { userId: true },
  });
  const userIds = members.map(m => m.userId);
  if (userIds.length === 0) return { total: 0, perMember: {} };

  const logs = await prisma.workoutLog.findMany({
    where: {
      userId: { in: userIds },
      date: { gte: challenge.startedAt, lte: challenge.endsAt },
    },
    select: { userId: true, sets: true },
  });

  const substrings = (challenge.exerciseSubstrings ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

  const perMember: Record<string, number> = {};
  for (const uid of userIds) perMember[uid] = 0;
  const distinctByUser = new Map<string, Set<string>>();

  for (const log of logs) {
    if (challenge.metric === "total_sessions") {
      perMember[log.userId] = (perMember[log.userId] ?? 0) + 1;
      continue;
    }
    const sets = (log.sets ?? {}) as Record<string, any>;
    for (const k in sets) {
      const v = sets[k];
      if (!v || v.skipped) continue;
      const parts = k.split("-");
      const last = parts[parts.length - 1];
      if (/^d\d+$/.test(last) && parts.length >= 3) { parts.pop(); parts.pop(); } else { parts.pop(); }
      const eid = parts.join("-").toLowerCase();
      if (substrings.length > 0) {
        const matches = substrings.some(s => eid.includes(s));
        if (!matches) continue;
      }
      if (challenge.metric === "total_reps") {
        perMember[log.userId] = (perMember[log.userId] ?? 0) + (v.reps ?? 0);
      } else if (challenge.metric === "total_volume_kg") {
        perMember[log.userId] = (perMember[log.userId] ?? 0) + (v.weight ?? 0) * (v.reps ?? 0);
      } else if (challenge.metric === "exercise_distinct") {
        const s = distinctByUser.get(log.userId) ?? new Set<string>();
        s.add(eid);
        distinctByUser.set(log.userId, s);
      }
    }
  }
  if (challenge.metric === "exercise_distinct") {
    distinctByUser.forEach((set, uid) => { perMember[uid] = set.size; });
  }
  const total = Object.values(perMember).reduce((s, v) => s + v, 0);
  return { total: Math.round(total), perMember };
}

// GET — list active + recent challenges for a group with live progress.
// Caller must be a member.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;
    const membership = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: uid } },
    });
    if (!membership) return json({ error: "Not a member" }, 403);

    const group = await prisma.leaderboardGroup.findUnique({
      where: { id: groupId },
      select: { id: true, createdBy: true },
    });
    if (!group) return json({ error: "Group not found" }, 404);

    const challenges = await (prisma as any).groupChallenge.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const enriched = await Promise.all(challenges.map(async (c: any) => {
      const prog = await computeProgress(c);
      const now = Date.now();
      const expired = c.endsAt.getTime() < now;
      const complete = prog.total >= c.target;
      const state = complete ? "completed" : expired ? "expired" : "active";
      return {
        ...c,
        progress: prog.total,
        perMember: prog.perMember,
        myContribution: prog.perMember[uid] ?? 0,
        state,
      };
    }));

    return json({ challenges: enriched, isLeader: group.createdBy === uid });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — leader starts a new challenge. Body: { metric, target, title, durationDays, exerciseSubstrings? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;
    const group = await prisma.leaderboardGroup.findUnique({ where: { id: groupId } });
    if (!group) return json({ error: "Group not found" }, 404);
    if (group.createdBy !== uid) return json({ error: "Only the group leader can start a challenge" }, 403);

    const body = await req.json();
    const { metric, target, title, durationDays, exerciseSubstrings } = body ?? {};
    if (!metric || !METRICS.has(metric)) return json({ error: "Invalid metric" }, 400);
    if (typeof target !== "number" || target <= 0) return json({ error: "Target must be a positive number" }, 400);
    if (typeof title !== "string" || !title.trim()) return json({ error: "Title required" }, 400);
    const days = typeof durationDays === "number" && durationDays > 0 && durationDays <= 90 ? Math.floor(durationDays) : 30;

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + days * 86400000);

    const created = await (prisma as any).groupChallenge.create({
      data: {
        groupId,
        createdBy: uid,
        metric,
        target: Math.floor(target),
        title: title.trim().slice(0, 80),
        exerciseSubstrings: typeof exerciseSubstrings === "string" && exerciseSubstrings.trim() ? exerciseSubstrings.trim() : null,
        startedAt,
        endsAt,
        state: "active",
      },
    });

    // System message in the group chat — announces the new mission
    // so members can chat about it. fromId stays null because this
    // is system-authored (the trainer's name lives in the body so the
    // attribution is obvious without a user avatar).
    // (qa: group-chat-system-messages)
    try {
      const creator = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      const who = creator?.username ?? "A trainer";
      await prisma.groupMessage.create({
        data: {
          groupId,
          fromId: null,
          type: "system_mission",
          body: `🎯 @${who} started a new mission: "${title.trim()}" — target ${Math.floor(target)} ${metric.replace(/_/g, " ")}${days ? `, ${days} days` : ""}.`,
        },
      });
    } catch {}

    return json({ challenge: { ...created, progress: 0, perMember: {}, myContribution: 0 } }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// DELETE — leader cancels an active challenge. Body: { challengeId }
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;
    const group = await prisma.leaderboardGroup.findUnique({ where: { id: groupId } });
    if (!group) return json({ error: "Group not found" }, 404);
    if (group.createdBy !== uid) return json({ error: "Only the group leader can cancel a challenge" }, 403);
    const { challengeId } = await req.json();
    if (!challengeId || typeof challengeId !== "string") return json({ error: "challengeId required" }, 400);
    const c = await (prisma as any).groupChallenge.findUnique({ where: { id: challengeId } });
    if (!c || c.groupId !== groupId) return json({ error: "Challenge not found" }, 404);
    await (prisma as any).groupChallenge.delete({ where: { id: challengeId } });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
