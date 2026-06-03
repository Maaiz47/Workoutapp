import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../../../../lib/prisma";
import { sendPushToUser } from "../../../../lib/push";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// POST /api/admin/qa-push-fanout
// Body (optional): { since?: ISO8601 string }
//
// Fires one push notification per (user, processed-but-unpushed comment) pair
// for entries in qa-processed.json whose manifest `ts` is >= `since` (defaults
// to NOW - 1 hour). Marks each pushed row with pushedAt to prevent duplicates.
//
// Built to close the gap @maaiz hit on 2026-06-03 where his 4 patches landed
// in the IRONLOG SYSTEM feed but no OS push fired — the in-app feed surfaces
// processed comments via /api/qa/comments/mine, but there was previously NO
// hook that actually delivered a push when qa-processed.json was updated.
//
// Workflow per QA pass:
//   1. Edit qa-processed.json + push the bundle (deploys via Vercel).
//   2. After deploy lands, call this endpoint with the QA pass timestamp:
//      curl -X POST https://<host>/api/admin/qa-push-fanout \
//        -H "x-admin-key: $ADMIN_SECRET" \
//        -H "Content-Type: application/json" \
//        -d '{"since":"2026-06-03T13:00:00Z"}'
//   3. Endpoint returns { sent, total, sinceUsed }.
// (qa: qa-patch-push-fanout)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const sinceParam = typeof (body as any)?.since === "string" ? (body as any).since : null;
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 3_600_000);
    if (Number.isNaN(since.getTime())) return json({ error: "Invalid since timestamp" }, 400);

    // Read qa-processed.json — same path /api/qa/comment* routes use.
    let manifest: Record<string, { ts?: string; sha?: string; summary?: string }> = {};
    try {
      const raw = await fs.readFile(path.join(process.cwd(), "qa-processed.json"), "utf-8");
      const parsed = JSON.parse(raw);
      manifest = parsed?.processedIds || {};
    } catch (e: any) {
      return json({ error: `Failed to read manifest: ${e?.message ?? "unknown"}` }, 500);
    }

    // Candidate comment ids: in manifest AND ts >= since.
    const candidateIds: string[] = [];
    for (const [id, entry] of Object.entries(manifest)) {
      const ts = entry?.ts ? new Date(entry.ts) : null;
      if (ts && !Number.isNaN(ts.getTime()) && ts.getTime() >= since.getTime()) {
        candidateIds.push(id);
      }
    }
    if (candidateIds.length === 0) {
      return json({ sent: 0, total: 0, sinceUsed: since.toISOString(), note: "No manifest entries newer than `since`." });
    }

    // Fetch comments matching the candidates, owned by a user, and not yet pushed.
    const comments = await (prisma as any).qAComment.findMany({
      where: {
        id: { in: candidateIds },
        userId: { not: null },
        pushedAt: null,
      },
      select: { id: true, userId: true, itemId: true, note: true },
    });

    let sent = 0;
    const errors: string[] = [];
    for (const c of comments) {
      const entry = manifest[c.id];
      const summary = (entry?.summary ?? "Your patch is ready to test.").replace(/\s+/g, " ").slice(0, 140);
      try {
        await sendPushToUser(c.userId, {
          title: "🔧 IRONLOG · Patch shipped",
          body: summary,
          url: `/qa?focus=${encodeURIComponent(c.itemId)}#comment-${c.id}`,
        });
        await (prisma as any).qAComment.update({
          where: { id: c.id },
          data: { pushedAt: new Date() },
        });
        sent++;
      } catch (e: any) {
        errors.push(`${c.id}: ${e?.message ?? "send failed"}`);
      }
    }

    return json({
      sent,
      total: comments.length,
      sinceUsed: since.toISOString(),
      candidates: candidateIds.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
