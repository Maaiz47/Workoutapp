import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mirrorCommentToRepo } from "@/lib/qaGitMirror";
import fs from "fs/promises";
import path from "path";

async function readProcessedManifest(): Promise<Record<string, { ts: string; sha?: string; summary?: string }>> {
  try {
    const p = path.join(process.cwd(), "qa-processed.json");
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed?.processedIds || {};
  } catch {
    return {};
  }
}

// POST /api/qa/comment
// Body: { itemId, tester, status, note, screenshotUrl? }
// Public — anyone testing can post. No admin gate.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, tester, status, note, screenshotUrl, stepIndex } = body || {};

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }
    if (!tester || typeof tester !== "string" || tester.trim().length === 0) {
      return NextResponse.json({ error: "tester is required" }, { status: 400 });
    }
    const validStatuses = ["untested", "passing", "failing", "regression-retest"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "status invalid" }, { status: 400 });
    }
    if (typeof note !== "string" || note.trim().length === 0) {
      return NextResponse.json({ error: "note is required" }, { status: 400 });
    }

    // Per-step scoping: stepIndex is the 0-indexed step within the
    // item's steps[] array that this comment refers to. Null/omitted
    // = comment is about the item as a whole. Validate that it's a
    // non-negative integer if provided. (qa: qa-per-step-comments)
    let parsedStepIndex: number | null = null;
    if (stepIndex !== undefined && stepIndex !== null) {
      const n = Number(stepIndex);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        return NextResponse.json({ error: "stepIndex must be a non-negative integer" }, { status: 400 });
      }
      parsedStepIndex = n;
    }

    // If the request carries the ironlog-uid cookie, attach the user to the
    // comment so the admin view can group by submitter. Public anonymous
    // submissions still work (userId stays null).
    const uid = req.cookies.get("ironlog-uid")?.value || null;

    const row = await (prisma as any).qAComment.create({
      data: {
        itemId,
        stepIndex: parsedStepIndex,
        tester: tester.trim(),
        userId: uid,
        status,
        note: note.trim(),
        screenshotUrl: screenshotUrl ? String(screenshotUrl).trim() : null,
      },
    });

    // Mirror the comment into the repo so Claude can git pull and read it.
    // Must AWAIT here — Vercel terminates the serverless function as soon as
    // the response is sent, which kills any unawaited in-flight fetch and
    // silently drops the mirror. The added latency is ~200-500ms but the
    // loop becomes reliable. Mirror failures are swallowed so a GitHub
    // outage never fails a user-facing submit.
    try { await mirrorCommentToRepo(row); } catch (e) { console.error("mirror failed:", e); }

    // Detect retest references and flip the parent comment's status to
    // match. Note format is "[🔄 RETEST · re:XXXXXXXX] …" where XXXXXXXX
    // is the last 8 chars of the parent comment id. If the parent
    // belongs to the same tester (or unattributed) and isn't already
    // at the new status, update it so the original comment's badge
    // reflects the latest verdict. Per @maaiz: "I marked this working
    // but the original comment stays showing untested which isn't right".
    // (qa: qa-retest-flips-parent-status)
    let parentUpdate: { id: string; status: string } | null = null;
    try {
      const reM = /\[🔄\s*RETEST\s*·\s*re:([a-z0-9]{4,})\]/i.exec(row.note);
      if (reM && reM[1]) {
        const shortId = reM[1].toLowerCase();
        // Lookup candidates by itemId + ending in shortId. Use raw
        // endsWith filter via findMany since Prisma can't directly
        // suffix-match an id.
        const candidates = await (prisma as any).qAComment.findMany({
          where: { itemId },
          select: { id: true, tester: true, userId: true, status: true },
        });
        const parent = candidates.find((c: any) => c.id.slice(-8).toLowerCase() === shortId);
        if (parent && parent.id !== row.id) {
          // Only patch when the same tester owns the parent (or no tester
          // attribution) — don't let a tester flip someone else's status.
          const sameOwner = (
            (parent.userId && parent.userId === uid) ||
            (!parent.userId && parent.tester && parent.tester.toLowerCase() === tester.trim().toLowerCase())
          );
          if (sameOwner && parent.status !== row.status) {
            await (prisma as any).qAComment.update({
              where: { id: parent.id },
              data: { status: row.status },
            });
            parentUpdate = { id: parent.id, status: row.status };
          }
        }
      }
    } catch (e) {
      console.error("parent-status flip failed:", e);
    }

    // Return the FULL comment so the client can add it to local state
    // without a re-fetch. Previous shape `{ok, id, ts}` missed the
    // `comment` field that InlineRetestForm reads — so just-submitted
    // replies vanished until a full reload. (qa: qa-retest-submit-appears-immediately)
    const processedMap = await readProcessedManifest();
    let userObj: any = null;
    if (uid) {
      try {
        userObj = await prisma.user.findUnique({
          where: { id: uid },
          select: { id: true, username: true, email: true, role: true },
        });
      } catch {}
    }
    const comment = {
      id: row.id,
      itemId: row.itemId,
      stepIndex: row.stepIndex,
      tester: row.tester,
      userId: row.userId,
      status: row.status,
      note: row.note,
      screenshotUrl: row.screenshotUrl,
      ts: row.ts,
      processed: processedMap[row.id] ? true : row.processed,
      user: userObj,
    };
    return NextResponse.json({ ok: true, id: row.id, ts: row.ts, comment, parentUpdate });
  } catch (e: any) {
    console.error("POST /api/qa/comment", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET /api/qa/comment?itemId=... — returns the comment thread for one item
// or all items if itemId is omitted. Public (the dashboard reads this).
export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  const where = itemId ? { itemId } : {};
  const rows = await (prisma as any).qAComment.findMany({
    where,
    orderBy: { ts: "asc" },
    select: {
      id: true, itemId: true, stepIndex: true, tester: true, userId: true, status: true,
      note: true, screenshotUrl: true, ts: true, processed: true,
    },
  });

  // Enrich with user data so the dashboard can group comments by username
  // (not just by the raw `tester` string). Done as a manual batched fetch
  // rather than a prisma `user` join because QAComment doesn't have a
  // schema-level @relation to User — adding one mid-deploy risks an FK
  // migration failure on any orphaned userIds.
  const userIds = Array.from(new Set(rows.map((r: any) => r.userId).filter(Boolean)));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds as string[] } },
        select: { id: true, username: true, email: true, role: true },
      })
    : [];
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  // Soft attribution: a comment posted with userId=null but tester name
  // matching a real username (case-insensitive) gets the user record
  // attached at read time. Lets testers who submitted while logged out
  // (e.g. Amanii's early QA pass on the auth flow) see their feedback
  // attributed in feedback history without a DB migration.
  // (qa: amanii-attribution)
  const anonTesterNames = Array.from(new Set(
    rows.filter((r: any) => !r.userId && typeof r.tester === "string" && r.tester.trim()).map((r: any) => r.tester.trim())
  )) as string[];
  const softUsers = anonTesterNames.length > 0
    ? await prisma.user.findMany({
        where: { username: { in: anonTesterNames, mode: "insensitive" } },
        select: { id: true, username: true, email: true, role: true },
      })
    : [];
  const softUserByName = new Map(softUsers.map((u: any) => [u.username.toLowerCase(), u]));

  const processedMap = await readProcessedManifest();
  const comments = rows.map((c: any) => {
    let user = c.userId ? (userMap.get(c.userId) || null) : null;
    if (!user && c.tester) {
      user = softUserByName.get(String(c.tester).toLowerCase()) || null;
    }
    return {
      ...c,
      user,
      processed: processedMap[c.id] ? true : c.processed,
    };
  });
  return NextResponse.json({ comments });
}
