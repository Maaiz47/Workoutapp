import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// Per @maaiz: 'System notification to users who report a bug through
// app when it's patched (with a quick link to the qa area about it).
// Same for if they submit an idea and if it gets approved during next
// push when you tell me.'
//
// User-facing read-only endpoint — returns the caller's OWN QAComments
// (bug reports + ideas — they're stored uniformly), annotated with
// processed status drawn from both the DB column and the file-backed
// qa-processed.json manifest (which is the canonical source after
// Claude commits a processing pass).
//
// Client uses this to:
//   1. Show a 'your report has been patched' system notification on
//      app load, with a link to the QA item.
//   2. Persist per-comment acks in localStorage so the same
//      notification doesn't re-fire after the user has seen it.
//
// (qa: qa-patch-notification)

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

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const comments = await (prisma as any).qAComment.findMany({
      where: { userId: uid },
      orderBy: { ts: "desc" },
    });
    if (comments.length === 0) return json({ comments: [] });

    const manifest = await readProcessedManifest();

    const annotated = comments.map((c: any) => {
      const fileEntry = manifest[c.id];
      const processed = c.processed === true || !!fileEntry;
      const processedSummary = fileEntry?.summary ?? null;
      const processedAt = c.processedAt ? c.processedAt.toISOString() : (fileEntry?.ts ?? null);
      const processedSha = c.processedSha ?? fileEntry?.sha ?? null;
      return {
        id: c.id,
        itemId: c.itemId,
        stepIndex: c.stepIndex,
        status: c.status,
        note: c.note,
        ts: c.ts.toISOString(),
        processed,
        processedAt,
        processedSha,
        processedSummary,
      };
    });

    return json({ comments: annotated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
