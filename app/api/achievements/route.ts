import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { ACHIEVEMENTS } from "../../../lib/achievements";

// Earned-achievements API. The achievement catalogue + detection logic
// live client-side (lib/achievements.ts) — the client walks the
// catalogue on each session save and tells the server which ids newly
// crossed. The server persists them (UserAchievement) so the earned set
// survives device changes and can gate the achievement-count avatars in
// /api/avatars. (qa: achievements-v1)

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// Valid achievement ids — guards the POST so a malformed/stale client
// can't insert junk rows. Removing an achievement from the catalogue is
// still safe (old rows just become orphans).
const VALID_IDS = new Set(ACHIEVEMENTS.map(a => a.id));

// GET — { earned: string[] } for the current user.
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const rows = await prisma.userAchievement.findMany({
      where: { userId: uid },
      select: { achievementId: true },
    });
    return json({ earned: rows.map(r => r.achievementId) });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — body { ids: string[] }. Idempotently records newly-earned
// achievements (also used for the one-time localStorage→server backfill
// of existing users). Returns the user's full earned list afterwards.
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids)) return json({ error: "ids must be an array" }, 400);
    // Dedupe + keep only known ids.
    const clean = Array.from(new Set(ids.filter((x): x is string => typeof x === "string" && VALID_IDS.has(x))));
    if (clean.length > 0) {
      await prisma.userAchievement.createMany({
        data: clean.map(achievementId => ({ userId: uid, achievementId })),
        skipDuplicates: true,
      });
    }
    const rows = await prisma.userAchievement.findMany({
      where: { userId: uid },
      select: { achievementId: true },
    });
    return json({ earned: rows.map(r => r.achievementId) });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// DELETE — body { ids: string[] }. Removes earned rows. Used only for
// the tier-relock path: when a user drops below a tier, the matching
// tier achievements are relocked client-side AND here, so a genuine
// re-climb fires the celebration again. (qa: tier-newuser-ramp)
export async function DELETE(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids)) return json({ error: "ids must be an array" }, 400);
    const clean = ids.filter((x): x is string => typeof x === "string");
    if (clean.length > 0) {
      await prisma.userAchievement.deleteMany({
        where: { userId: uid, achievementId: { in: clean } },
      });
    }
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
