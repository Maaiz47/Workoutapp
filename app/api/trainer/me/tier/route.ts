import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../../lib/leaderboardStats";
import { computeTrainerTier, TrainerStatsForTier } from "../../../../../lib/tiers";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET /api/trainer/me/tier
// Returns the calling trainer's full multi-dim TierBreakdown — same
// canonical computeTrainerTier() the rest of the app uses, but computed
// from server-side roster stats so every surface reads from the same
// source. Returns 200 + { breakdown: null } for non-trainers, so the
// frontend doesn't 404-spam for athletes who never enter the trainer
// surface. (qa: tier-trainer-keeps-athlete)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const me = await prisma.user.findUnique({ where: { id: uid } });
    const isTrainer = me?.role === "trainer" || (me as any)?.extraRoles?.includes?.("trainer");
    if (!isTrainer) return json({ breakdown: null });

    const links = await prisma.trainerClient.findMany({
      where: { trainerId: uid },
      select: { clientId: true },
    });
    const clientIds = links.map(l => l.clientId);

    if (clientIds.length === 0) {
      const breakdown = computeTrainerTier({
        rosterCount: 0,
        clientsWithRecentPR: 0,
        clientsWithActiveStreak: 0,
        totalClientPRs: 0,
        totalClientVolumeKg: 0,
      });
      return json({ breakdown });
    }

    const statsByUser = await computeStatsForUsers(clientIds);

    // Walk each client's stats and aggregate the four dimensions.
    // "Recent PR" is approximated as `prCount > 0 AND last session
    // within 30 days` — we don't track per-PR timestamps in the
    // aggregate, but an active client with PRs is the same signal.
    let clientsWithRecentPR = 0;
    let clientsWithActiveStreak = 0;
    let totalClientPRs = 0;
    let totalClientVolumeKg = 0;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    for (const cid of clientIds) {
      const s = statsByUser.get(cid);
      if (!s) continue;
      totalClientPRs += s.prCount ?? 0;
      totalClientVolumeKg += s.totalVolume ?? 0;
      const last = s.lastSession ? new Date(s.lastSession).getTime() : 0;
      if ((s.prCount ?? 0) > 0 && last >= thirtyDaysAgo) clientsWithRecentPR++;
      if ((s.streak ?? 0) >= 7) clientsWithActiveStreak++;
    }

    const stats: TrainerStatsForTier = {
      rosterCount: clientIds.length,
      clientsWithRecentPR,
      clientsWithActiveStreak,
      totalClientPRs,
      totalClientVolumeKg,
    };
    const breakdown = computeTrainerTier(stats);
    return json({ breakdown, stats });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
