import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { AVATARS, ADMIN_AVATAR_POOL, tierAvatarsAtOrBelow, findAvatar } from "../../../lib/avatars";
import { computeStatsForUsers } from "../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — returns the user's avatar inventory:
//   {
//     selected: avatarId | null,
//     tierUnlocked: Avatar[],        // tier-source unlocks they qualify for
//     luckyUnlocked: Avatar[],       // lucky drops they've earned
//     all: Avatar[],                 // catalogue (so client can show locked silhouettes)
//     tier: number,                  // current athlete tier 1-6
//     tierScoreBonus: number,        // cumulative lucky-drop score bonus
//   }
//
// Side-effect: any tier-source avatars the user qualifies for but
// hasn't been minted yet get a UserAvatarUnlock row added so the
// /api/workout celebration flow can rely on inventory state being
// accurate at award time.
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const [user, profile, statsMap, existingUnlocks] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { role: true, extraRoles: true } }),
      prisma.userProfile.findUnique({ where: { userId: uid } }),
      computeStatsForUsers([uid]),
      (prisma as any).userAvatarUnlock.findMany({ where: { userId: uid } }),
    ]);
    const isAdmin = user?.role === "admin" || (Array.isArray(user?.extraRoles) && user!.extraRoles.includes("admin"));
    const tier = statsMap.get(uid)?.tier;
    const tierIdx = (tier?.idx ?? 0) + 1;     // 1-based
    const qualifiedTier = tierAvatarsAtOrBelow(tierIdx);

    // Relock tier-source unlocks above the user's current canonical
    // tier. Necessary after tier-scoring recalibration (qa: tier-
    // newuser-ramp) — users who were temporarily at a higher tier
    // off the back of the old flat-50 freebie shouldn't keep the
    // tier-gated avatars they didn't actually earn. Lucky-source
    // unlocks are permanent — never revoked.
    let ownedIds = new Set<string>(existingUnlocks.map((u: any) => u.avatarId));
    const tooHigh = existingUnlocks.filter((u: any) => u.source === "tier" && (u.tier ?? 0) > tierIdx);
    if (tooHigh.length > 0) {
      await (prisma as any).userAvatarUnlock.deleteMany({
        where: { userId: uid, avatarId: { in: tooHigh.map((u: any) => u.avatarId) } },
      });
      for (const u of tooHigh) ownedIds.delete(u.avatarId);
    }

    // If the user's equipped avatar is now relocked, revert it so the
    // PATCH-side ownership check doesn't 403 the next interaction and
    // so the UI doesn't render a "ghost" equipped state. Lucky avatars
    // never get cleared because they're never relocked.
    let selected = profile?.avatarId ?? null;
    if (selected) {
      const equipped = findAvatar(selected);
      if (equipped?.source === "tier" && (equipped.tier ?? 0) > tierIdx) {
        await prisma.userProfile.update({ where: { userId: uid }, data: { avatarId: null } });
        selected = null;
      }
    }

    // Backfill any missing tier-source unlocks (idempotent).
    const toMint = qualifiedTier.filter(a => !ownedIds.has(a.id));
    if (toMint.length > 0) {
      await (prisma as any).userAvatarUnlock.createMany({
        data: toMint.map(a => ({ userId: uid, avatarId: a.id, source: "tier", tier: a.tier })),
        skipDuplicates: true,
      });
      for (const a of toMint) ownedIds.add(a.id);
    }

    // Admin-exclusive avatars — auto-minted whenever an admin viewer
    // hits /api/avatars without owning them yet. Idempotent. Non-admin
    // accounts NEVER touch this path, so the catalogue stays locked
    // off for everyone else (the PATCH ownership check also rejects
    // equipping an unowned avatar). (qa: avatars-admin-exclusive)
    if (isAdmin) {
      const adminToMint = ADMIN_AVATAR_POOL.filter(a => !ownedIds.has(a.id));
      if (adminToMint.length > 0) {
        await (prisma as any).userAvatarUnlock.createMany({
          data: adminToMint.map(a => ({ userId: uid, avatarId: a.id, source: "admin" as any, tier: null })),
          skipDuplicates: true,
        });
        for (const a of adminToMint) ownedIds.add(a.id);
      }
    }

    const luckyUnlocked = AVATARS.filter(a => a.source === "lucky" && ownedIds.has(a.id));
    const tierUnlocked = AVATARS.filter(a => a.source === "tier" && ownedIds.has(a.id));
    const adminUnlocked = AVATARS.filter(a => a.source === "admin" && ownedIds.has(a.id));

    return json({
      selected,
      tierUnlocked,
      luckyUnlocked,
      adminUnlocked,
      all: AVATARS,
      tier: tierIdx,
      tierScoreBonus: profile?.tierScoreBonus ?? 0,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// PATCH — set the user's selected avatar. Body: { avatarId: string | null }.
// Verifies the avatar exists in the catalogue AND that the user has
// unlocked it (either tier-unlocked or earned via a lucky drop).
export async function PATCH(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const { avatarId } = await req.json();
    if (avatarId !== null && typeof avatarId !== "string") {
      return json({ error: "avatarId must be string or null" }, 400);
    }
    if (avatarId !== null) {
      if (!findAvatar(avatarId)) return json({ error: "Unknown avatar" }, 400);
      const owned = await (prisma as any).userAvatarUnlock.findUnique({
        where: { userId_avatarId: { userId: uid, avatarId } },
      });
      if (!owned) return json({ error: "Avatar not unlocked yet" }, 403);
    }
    await prisma.userProfile.update({ where: { userId: uid }, data: { avatarId } });
    return json({ success: true, selected: avatarId });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
