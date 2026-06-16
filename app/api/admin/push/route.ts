import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendPushToUser } from "../../../../lib/push";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// POST /api/admin/push
// Body: { usernames: string[], title: string, body: string, url?: string }
//
// One-off ad-hoc push to specific users by username (case-insensitive). Used
// for manual announcements — e.g. telling beta testers a fix has shipped.
// Returns a per-user breakdown of how many device subscriptions were targeted
// so you can see who actually has push enabled.
//
//   curl -X POST https://<host>/api/admin/push \
//     -H "x-admin-key: $ADMIN_SECRET" -H "Content-Type: application/json" \
//     -d '{"usernames":["munchy","alla"],"title":"…","body":"…","url":"/"}'
// (qa: admin-ad-hoc-push)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({} as any));
    const usernames: string[] = Array.isArray(body?.usernames)
      ? body.usernames.filter((u: unknown) => typeof u === "string" && u.trim())
      : [];
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const message = typeof body?.body === "string" ? body.body.trim() : "";
    const url = typeof body?.url === "string" && body.url.trim() ? body.url.trim() : "/";

    if (usernames.length === 0) return json({ error: "usernames[] required" }, 400);
    if (!title || !message) return json({ error: "title and body required" }, 400);

    const wanted = usernames.map(u => u.trim().toLowerCase());
    const users = await prisma.user.findMany({
      where: { username: { in: wanted, mode: "insensitive" } },
      select: { id: true, username: true },
    });

    const found = new Set(users.map(u => u.username.toLowerCase()));
    const notFound = wanted.filter(u => !found.has(u));

    const results: Array<{ username: string; subscriptions: number }> = [];
    for (const u of users) {
      const subs = await prisma.pushSubscription.count({ where: { userId: u.id } });
      await sendPushToUser(u.id, { title, body: message, url });
      results.push({ username: u.username, subscriptions: subs });
    }

    return json({
      ok: true,
      sentTo: results,
      ...(notFound.length > 0 ? { notFound } : {}),
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
