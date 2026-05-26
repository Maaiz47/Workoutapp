import { NextRequest, NextResponse } from "next/server";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET /api/me/tier
// Returns the calling athlete's canonical headline tier — same DB-truth
// the global leaderboard uses, computed server-side from the same
// computeStatsForUsers() pipeline. Home + Progress dashboards consume
// this so the headline tier they display matches the Rankings page
// (and the on-app-open promotion toast). Previously they computed
// locally from cached `history` / `bodyMetrics`, which lagged the
// server by one workout and lost the user at the tier boundary.
// Source: @maaiz 2026-05-26 "Got the achievement celebration or tier
// celebration for reaching lion on app open but it says big dawg on
// home and progress page. Which is it!?!?"
// (qa: tier-consistency-home-progress, tier-promotion-toast)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const statsByUser = await computeStatsForUsers([uid]);
    const s = statsByUser.get(uid);
    if (!s?.tier) return json({ tier: null });
    return json({
      tier: {
        tierNum: s.tier.tierNum,
        label: s.tier.label,
        icon: s.tier.icon,
        iconPath: s.tier.iconPath,
        color: s.tier.color,
        bg: s.tier.bg,
        border: s.tier.border,
        min: s.tier.min,
        score: s.tier.score,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
