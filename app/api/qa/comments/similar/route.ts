import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// Lightweight duplicate / "you've reported this before" detection for
// the QuickFeedback FAB. Per @maaiz: 'These random quick notes qa
// submissions will be checked for relevance to existing reported
// issues and test areas and marked as a recommend for history and
// reduce duplicates right?'.
//
// Slice 1 — keyword overlap against the user's OWN prior comments
// (cheapest, most relevant signal). Cross-user de-dup is a future
// slice and would need a server-side index for fairness — for now
// surfacing "you said this already on X" is the headline feature.
// (qa: qa-duplicate-detection)

// Strip bracketed prefix tags ("[🐞 BUG · UI · view=home]") so the
// match is on the actual prose.
function stripPrefix(s: string): string {
  return s.replace(/^\[[^\]]+\]\s*/, "").trim();
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","of","in","on","at","to","for","with","by",
  "and","or","but","not","no","so","if","as","it","its","this","that","these","those","i","you","we","they",
  "my","your","our","their","me","us","him","her","them","do","does","did","done","have","has","had","just",
  "will","would","could","should","can","may","might","when","where","what","which","who","why","how","than",
  "then","there","here","also","still","yet","now","again","very","really","only","even","more","most","some",
  "any","all","each","every","one","two","three","like","unlike","seem","seems","into","onto","from","off","up",
  "down","out","over","under","about","because","while","until","through","across","between","both","either",
  "neither","such","other","another","same","different","new","old","first","last","next","previous"
]);

function tokenise(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function overlap(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const a = new Set(aTokens);
  let hits = 0;
  for (const t of bTokens) if (a.has(t)) hits++;
  return hits / Math.max(a.size, new Set(bTokens).size);
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ matches: [] }); // unauthed → silently empty

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 15) return json({ matches: [] }); // too short to be meaningful

  try {
    const qTokens = tokenise(q);
    if (qTokens.length < 3) return json({ matches: [] });

    // Pull this user's last 100 comments — covers a few weeks of feedback
    // without scanning the whole table.
    const prior = await (prisma as any).qAComment.findMany({
      where: { userId: uid },
      orderBy: { ts: "desc" },
      take: 100,
    });

    const scored = prior
      .map((c: any) => {
        const text = stripPrefix(typeof c.note === "string" ? c.note : "");
        const score = overlap(qTokens, tokenise(text));
        return { id: c.id, itemId: c.itemId, ts: c.ts.toISOString(), note: text.slice(0, 180), score };
      })
      .filter((m: any) => m.score >= 0.25) // ~quarter of distinct words shared
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);

    return json({ matches: scored });
  } catch (e: any) {
    return json({ matches: [], error: e?.message ?? "Failed" }, 200);
  }
}
