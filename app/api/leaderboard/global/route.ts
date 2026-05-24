import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";
import { computeTrainerTier } from "../../../../lib/tiers";
import { getAppConfigBool, CONFIG_KEY_SHOW_TEST_USERS } from "../../../../lib/testUsers";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET /api/leaderboard/global
// Query params:
//   kind:  "athlete" (default) | "trainer"
//   lens:  "top" (default) | "band" | "around"
//   limit: optional, default 100 (top), 50 (band), 11 (around)
//
// Returns a single ranked list across the entire active user base
// plus meta on the viewer's rank.
//
//   { rows: [{rank, userId, username, anonymous, tierNum, score, ...}],
//     meta: { totalParticipants, viewerRank, viewerTierNum } }
//
// Anonymity rules:
//   - Athletes can opt OUT via profile.hideFromGlobalLeaderboard.
//     Their row still appears in the ranked list but with
//     anonymous=true (username swapped for "Athlete #<rank>" on the
//     client).
//   - Trainers are always public — the trainer board is for
//     athletes to discover coaches, not for hiding.
//
// Activity filter: athletes with < 5 lifetime sessions are skipped
// (filters out bots + casual accounts so the top of the board
// reflects real lifters).
// (qa: tier-global-leaderboard)

const MIN_SESSIONS_TO_QUALIFY = 5;

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const kind = (req.nextUrl.searchParams.get("kind") || "athlete") as "athlete" | "trainer";
  const lens = (req.nextUrl.searchParams.get("lens") || "top") as "top" | "band" | "around";
  // Athletes-board sub-filter:
  //   'all'           — every qualified athlete (default)
  //   'solo'          — only athletes who don't have an adopted trainer
  //   'with-trainer'  — only athletes who have an adopted trainer
  // Trainer board ignores this. (qa: global-leaderboard-coached-filter)
  const coached = (req.nextUrl.searchParams.get("coached") || "all") as "all" | "solo" | "with-trainer";
  const defaultLimits: Record<typeof lens, number> = { top: 100, band: 50, around: 11 } as any;
  const limit = Math.max(1, Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") || "") || defaultLimits[lens]));

  try {
    if (kind === "trainer") {
      return await trainerBoard(uid, lens, limit);
    }
    return await athleteBoard(uid, lens, limit, coached);
  } catch (e: any) {
    console.error("global leaderboard error:", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

async function athleteBoard(viewerUid: string, lens: "top" | "band" | "around", limit: number, coached: "all" | "solo" | "with-trainer") {
  // Pull every user who has logged at least MIN_SESSIONS sessions.
  // Counting via _count keeps this cheap — no joins into the sets
  // JSON payloads.
  // Test users (isTestUser=true) filtered out unless the admin has
  // explicitly enabled AppConfig.showTestUsersInLeaderboards. Default
  // is OFF so synthetic data never leaks to real users.
  // (qa: test-user-generator)
  const showTestUsers = await getAppConfigBool(CONFIG_KEY_SHOW_TEST_USERS, false);
  const baseWhere: any = { workoutLogs: { some: {} } };
  if (!showTestUsers) baseWhere.isTestUser = false;
  // role + extraRoles needed so we can compute + attach the trainer
  // tier badge alongside the athlete tier for users who coach.
  // (qa: global-leaderboard-trainer-badge)
  const candidates: any[] = await (prisma.user as any).findMany({
    where: baseWhere,
    select: {
      id: true,
      username: true,
      role: true,
      extraRoles: true,
      profile: { select: { hideFromGlobalLeaderboard: true, avatarId: true } },
      _count: { select: { workoutLogs: true } },
    },
  });
  const qualifiedIds = candidates.filter((c: any) => (c._count?.workoutLogs ?? 0) >= MIN_SESSIONS_TO_QUALIFY).map((c: any) => c.id);
  if (qualifiedIds.length === 0) {
    return json({ rows: [], meta: { totalParticipants: 0, viewerRank: null, viewerTierNum: null } });
  }

  // Identify trainers among qualified athletes (for the trainer-tier
  // badge) and pull all TrainerClient links so we can both compute
  // trainer tiers AND know which athletes have an adopted coach (for
  // the coached/solo filter).
  const trainerCandidateIds = candidates
    .filter((c: any) => qualifiedIds.includes(c.id) && (c.role === "trainer" || (c.extraRoles ?? []).includes("trainer")))
    .map((c: any) => c.id);

  const links = await prisma.trainerClient.findMany({
    where: {
      OR: [
        ...(trainerCandidateIds.length ? [{ trainerId: { in: trainerCandidateIds } }] : []),
        { clientId: { in: qualifiedIds } },
      ],
    },
    select: { trainerId: true, clientId: true },
  });
  const rosterByTrainer = new Map<string, string[]>();
  const coachedClientIds = new Set<string>();
  for (const l of links) {
    if (!rosterByTrainer.has(l.trainerId)) rosterByTrainer.set(l.trainerId, []);
    rosterByTrainer.get(l.trainerId)!.push(l.clientId);
    if (qualifiedIds.includes(l.clientId)) coachedClientIds.add(l.clientId);
  }

  // One batched stats call covering qualified athletes + every
  // trainer + every roster client (some overlap is fine — Set dedupes).
  const statsIds = new Set<string>(qualifiedIds);
  for (const tid of trainerCandidateIds) statsIds.add(tid);
  for (const l of links) statsIds.add(l.clientId);
  const statsByUser = await computeStatsForUsers(Array.from(statsIds));

  // Compute trainer tier per trainer once — looked up per row.
  const thirtyDaysAgoMs = Date.now() - 30 * 86400000;
  const trainerTierByUser = new Map<string, { tierNum: number; label: string; icon: string; iconPath?: string; color: string }>();
  for (const tid of trainerCandidateIds) {
    const roster = rosterByTrainer.get(tid) ?? [];
    let clientsWithRecentPR = 0;
    let clientsWithActiveStreak = 0;
    let totalClientPRs = 0;
    let totalClientVolumeKg = 0;
    for (const cid of roster) {
      const s = statsByUser.get(cid);
      if (!s) continue;
      totalClientPRs += s.prCount ?? 0;
      totalClientVolumeKg += s.totalVolume ?? 0;
      const last = s.lastSession ? new Date(s.lastSession).getTime() : 0;
      if ((s.prCount ?? 0) > 0 && last >= thirtyDaysAgoMs) clientsWithRecentPR++;
      if ((s.streak ?? 0) >= 7) clientsWithActiveStreak++;
    }
    const selfAthleteScore = statsByUser.get(tid)?.tier?.score ?? 0;
    const breakdown = computeTrainerTier({
      rosterCount: roster.length,
      clientsWithRecentPR,
      clientsWithActiveStreak,
      totalClientPRs,
      totalClientVolumeKg,
      selfAthleteScore,
    });
    trainerTierByUser.set(tid, {
      tierNum: breakdown.headline.tierNum,
      label: breakdown.headline.label,
      icon: breakdown.headline.icon,
      iconPath: breakdown.headline.iconPath,
      color: breakdown.headline.color,
    });
  }

  type Row = { rank: number; userId: string; username: string; avatarId: string | null; anonymous: boolean; tierNum: number; tierIconPath?: string; tierEmoji?: string; score: number; totalSessions: number; streak: number; prCount: number; trainerTier: { tierNum: number; label: string; icon: string; iconPath?: string; color: string } | null; hasTrainer: boolean; };

  const allRows: Row[] = candidates
    .filter((c: any) => qualifiedIds.includes(c.id))
    .map((c: any): Row => {
      const s = statsByUser.get(c.id);
      const score = s?.tier?.score ?? 0;
      const tierNum = (s?.tier as any)?.tierNum ?? 1;
      const anonymous = c.profile?.hideFromGlobalLeaderboard === true && c.id !== viewerUid;
      return {
        rank: 0, // filled in below
        userId: c.id,
        username: c.username,
        avatarId: anonymous ? null : (c.profile?.avatarId ?? null),
        anonymous,
        tierNum,
        tierIconPath: s?.tier?.iconPath,
        tierEmoji: s?.tier?.icon,
        score,
        totalSessions: s?.totalSessions ?? 0,
        streak: s?.streak ?? 0,
        prCount: s?.prCount ?? 0,
        trainerTier: trainerTierByUser.get(c.id) ?? null,
        hasTrainer: coachedClientIds.has(c.id),
      };
    })
    .filter((r: Row) => {
      if (coached === "solo") return !r.hasTrainer;
      if (coached === "with-trainer") return r.hasTrainer;
      return true;
    })
    .sort((a, b) => b.score - a.score || b.totalSessions - a.totalSessions);
  allRows.forEach((r, i) => { r.rank = i + 1; });

  const viewer = allRows.find(r => r.userId === viewerUid) ?? null;
  let rows: Row[];
  if (lens === "top") {
    rows = allRows.slice(0, limit);
  } else if (lens === "band" && viewer) {
    rows = allRows.filter(r => r.tierNum === viewer.tierNum).slice(0, limit);
  } else if (lens === "around" && viewer) {
    const half = Math.floor(limit / 2);
    const start = Math.max(0, viewer.rank - 1 - half);
    rows = allRows.slice(start, start + limit);
  } else {
    rows = allRows.slice(0, limit);
  }

  return json({
    rows,
    meta: {
      totalParticipants: allRows.length,
      viewerRank: viewer?.rank ?? null,
      viewerTierNum: viewer?.tierNum ?? null,
    },
  });
}

async function trainerBoard(viewerUid: string, lens: "top" | "band" | "around", limit: number) {
  // Same test-user filter as the athlete board — synthetic trainers
  // are hidden unless the admin has flipped the visibility toggle on.
  const showTestUsers = await getAppConfigBool(CONFIG_KEY_SHOW_TEST_USERS, false);
  const trainerWhere: any = {
    OR: [
      { role: "trainer" },
      { extraRoles: { has: "trainer" } },
    ],
  };
  if (!showTestUsers) trainerWhere.isTestUser = false;
  const trainerCandidates = await prisma.user.findMany({
    where: trainerWhere,
    select: { id: true, username: true, profile: { select: { avatarId: true } } },
  });

  if (trainerCandidates.length === 0) {
    return json({ rows: [], meta: { totalParticipants: 0, viewerRank: null, viewerTierNum: null } });
  }

  // Aggregate each trainer's roster stats + their own athlete score.
  // One pass: gather all rosters, batch-fetch stats for unique
  // clientIds + trainerIds at once.
  const links = await prisma.trainerClient.findMany({
    where: { trainerId: { in: trainerCandidates.map(t => t.id) } },
    select: { trainerId: true, clientId: true },
  });
  const rosterByTrainer = new Map<string, string[]>();
  for (const l of links) {
    if (!rosterByTrainer.has(l.trainerId)) rosterByTrainer.set(l.trainerId, []);
    rosterByTrainer.get(l.trainerId)!.push(l.clientId);
  }

  const allUids = new Set<string>();
  for (const t of trainerCandidates) allUids.add(t.id);
  for (const l of links) allUids.add(l.clientId);
  const statsByUser = await computeStatsForUsers(Array.from(allUids));

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  type TRow = { rank: number; userId: string; username: string; avatarId: string | null; anonymous: boolean; tierNum: number; tierIconPath?: string; tierEmoji?: string; score: number; rosterCount: number; clientsWithRecentPR: number; selfAthleteScore: number; };
  const allRows: TRow[] = trainerCandidates.map(t => {
    const roster = rosterByTrainer.get(t.id) ?? [];
    let clientsWithRecentPR = 0;
    let clientsWithActiveStreak = 0;
    let totalClientPRs = 0;
    let totalClientVolumeKg = 0;
    for (const cid of roster) {
      const s = statsByUser.get(cid);
      if (!s) continue;
      totalClientPRs += s.prCount ?? 0;
      totalClientVolumeKg += s.totalVolume ?? 0;
      const last = s.lastSession ? new Date(s.lastSession).getTime() : 0;
      if ((s.prCount ?? 0) > 0 && last >= thirtyDaysAgo) clientsWithRecentPR++;
      if ((s.streak ?? 0) >= 7) clientsWithActiveStreak++;
    }
    const selfAthleteScore = statsByUser.get(t.id)?.tier?.score ?? 0;
    const breakdown = computeTrainerTier({
      rosterCount: roster.length,
      clientsWithRecentPR,
      clientsWithActiveStreak,
      totalClientPRs,
      totalClientVolumeKg,
      selfAthleteScore,
    });
    return {
      rank: 0,
      userId: t.id,
      username: t.username,
      avatarId: (t as any)?.profile?.avatarId ?? null,
      anonymous: false, // trainers always public per user direction
      tierNum: breakdown.headline.tierNum,
      tierIconPath: breakdown.headline.iconPath,
      tierEmoji: breakdown.headline.icon,
      score: breakdown.headlineScore,
      rosterCount: roster.length,
      clientsWithRecentPR,
      selfAthleteScore,
    };
  }).sort((a, b) => b.score - a.score || b.rosterCount - a.rosterCount);
  allRows.forEach((r, i) => { r.rank = i + 1; });

  const viewer = allRows.find(r => r.userId === viewerUid) ?? null;
  let rows: TRow[];
  if (lens === "top") {
    rows = allRows.slice(0, limit);
  } else if (lens === "band" && viewer) {
    rows = allRows.filter(r => r.tierNum === viewer.tierNum).slice(0, limit);
  } else if (lens === "around" && viewer) {
    const half = Math.floor(limit / 2);
    const start = Math.max(0, viewer.rank - 1 - half);
    rows = allRows.slice(start, start + limit);
  } else {
    rows = allRows.slice(0, limit);
  }

  return json({
    rows,
    meta: {
      totalParticipants: allRows.length,
      viewerRank: viewer?.rank ?? null,
      viewerTierNum: viewer?.tierNum ?? null,
    },
  });
}
