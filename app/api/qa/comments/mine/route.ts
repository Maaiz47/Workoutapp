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

// Strip developer noise from a processed-comment summary so the user
// sees plain English: "what was reported, what was addressed". Drops
// (qa: ...) tags, commit-sha-ish 7-char hex words, technical
// before/after value notation ("z-index 9000 → 9600"), and parenthesised
// asides. Keeps the first 1-2 sentences of plain prose.
// (qa: qa-patch-summary-user-friendly)
function simplifyForUser(raw: string): string {
  let s = raw;
  // Strip the leading "@user:" attribution + the embedded quote of the
  // user's original message — they wrote it, they know what they said.
  s = s.replace(/^@\w+:\s*'[^']+'\.\s*/i, "");
  s = s.replace(/^@\w+:\s*"[^"]+"\.\s*/i, "");
  // Strip (qa: foo, bar) tags wherever they appear.
  s = s.replace(/\(qa:\s*[^)]+\)/gi, "");
  // Strip "(commit abc1234)" / "commit abc1234" references.
  s = s.replace(/\(?\s*commit\s+[0-9a-f]{6,12}\s*\)?/gi, "");
  // Strip standalone 7-12 char hex words (commit shas).
  s = s.replace(/\b[0-9a-f]{7,12}\b/g, "");
  // Strip number-arrow-number patterns ("z-index 9000 → 9600", "9000 -> 9600").
  s = s.replace(/\b[a-zA-Z-]+\s*\d+\s*(→|->|to)\s*\d+/g, "");
  // Strip parenthesised technical asides.
  s = s.replace(/\([^)]*(?:filter|css|prisma|api|endpoint|state|hook|component|prop|sha|index|migration|schema)[^)]*\)/gi, "");
  // Collapse whitespace.
  s = s.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
  // Take up to first 2 sentences OR 200 chars (whichever shorter).
  const sentences = s.split(/(?<=[.!?])\s+/);
  let out = sentences.slice(0, 2).join(" ").trim();
  if (out.length > 200) out = out.slice(0, 197).trimEnd() + "…";
  return out || raw;
}

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
      const rawSummary: string | null = fileEntry?.summary ?? null;
      // User-facing simplification — strip the technical noise from the
      // internal processed summary so users see "what was reported, what
      // was addressed", not commit shas / qa tags / before-after numbers.
      // Per @maaiz: 'System users don't need to know exact language
      // models and detailed changes - just a summary'.
      // (qa: qa-patch-summary-user-friendly)
      const processedSummary = rawSummary ? simplifyForUser(rawSummary) : null;
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
