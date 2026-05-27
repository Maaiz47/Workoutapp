import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET /api/users/[userId]/preview
// Returns public-safe profile data for the profile preview modal +
// the viewer-relative relationship state (friendship + trainer link
// + pending requests) the modal needs to render the right action
// buttons. Tier comes from the canonical computeStatsForUsers
// pipeline so it matches what the leaderboard shows.
//
// Privacy: never exposes body metrics, goals, training preferences,
// dob, or email. hideFromGlobalLeaderboard does NOT anonymise the
// preview itself — that flag is for global-rank anonymity only; if
// the viewer has clicked through to this preview they already know
// who they're looking at (it's their friend / a partner in chat /
// a leaderboard row they tapped).
// (qa: profile-preview-modal)
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const viewerId = req.cookies.get(COOKIE)?.value;
  if (!viewerId) return json({ error: "Unauthorized" }, 401);
  const targetId = params.userId;
  if (!targetId) return json({ error: "Missing userId" }, 400);

  try {
    const isSelf = viewerId === targetId;

    const [target, statsMap, friendships, trainerLinkAsClient, trainerLinkAsTrainer, trainerReqIn, trainerReqOut] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          username: true,
          role: true,
          extraRoles: true,
          createdAt: true,
          profile: { select: { avatarId: true, hideFromGlobalLeaderboard: true } },
        },
      }),
      computeStatsForUsers([targetId]),
      isSelf ? [] : prisma.friendship.findMany({
        where: {
          OR: [
            { userAId: viewerId, userBId: targetId },
            { userAId: targetId, userBId: viewerId },
          ],
        },
      }),
      // viewer is a trainer, target is the viewer's client?
      isSelf ? null : prisma.trainerClient.findFirst({
        where: { trainerId: viewerId, clientId: targetId },
      }),
      // viewer is an athlete, target is the viewer's trainer?
      isSelf ? null : prisma.trainerClient.findFirst({
        where: { trainerId: targetId, clientId: viewerId },
      }),
      // target trainer sent an adoption request to viewer?
      isSelf ? null : prisma.trainerRequest.findFirst({
        where: { trainerId: targetId, userId: viewerId, status: "pending" },
      }),
      // viewer trainer sent an adoption request to target?
      isSelf ? null : prisma.trainerRequest.findFirst({
        where: { trainerId: viewerId, userId: targetId, status: "pending" },
      }),
    ]);

    if (!target) return json({ error: "Not found" }, 404);

    const stats = statsMap.get(targetId);
    const friendship = friendships[0] ?? null;
    let fState: "none" | "pending-sent" | "pending-received" | "accepted" | "blocked" = "none";
    if (friendship) {
      if (friendship.status === "accepted") fState = "accepted";
      else if (friendship.status === "blocked") fState = "blocked";
      else if (friendship.status === "pending") {
        // userAId is always the requester (per Friendship schema comment).
        fState = friendship.userAId === viewerId ? "pending-sent" : "pending-received";
      }
    }

    return json({
      isSelf,
      user: {
        id: target.id,
        username: target.username,
        role: target.role,
        extraRoles: target.extraRoles ?? [],
        createdAt: target.createdAt,
        avatarId: target.profile?.avatarId ?? null,
        hideFromGlobalLeaderboard: target.profile?.hideFromGlobalLeaderboard ?? false,
      },
      tier: stats?.tier ? {
        tierNum: stats.tier.tierNum,
        label: stats.tier.label,
        iconPath: stats.tier.iconPath,
        icon: stats.tier.icon,
        color: stats.tier.color,
        score: stats.tier.score,
      } : null,
      friendship: {
        status: fState,
        friendshipId: friendship?.id ?? null,
      },
      trainerRelation: {
        isMyClient: !!trainerLinkAsClient,
        isMyTrainer: !!trainerLinkAsTrainer,
        requestOutgoing: !!trainerReqOut,
        requestIncoming: !!trainerReqIn,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
