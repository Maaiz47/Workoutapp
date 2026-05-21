// Mirror every QA comment submission to the repo via the GitHub Contents API,
// so Claude can `git pull` and read accumulated feedback without ever calling
// the production DB.
//
// Required Vercel env vars:
//   GH_QA_TOKEN — fine-grained PAT with Contents: read+write on the repo
//   GH_QA_REPO  — "owner/name", e.g. "maaiz47/workoutapp"
//   GH_QA_BRANCH (optional, defaults to "main")
//
// If GH_QA_TOKEN is unset the mirror is silently skipped so local/dev still
// works without GitHub credentials.

type Comment = {
  id: string;
  itemId: string;
  tester: string;
  userId?: string | null;
  status: string;
  note: string;
  screenshotUrl?: string | null;
  ts: Date | string;
};

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export async function mirrorCommentToRepo(c: Comment): Promise<void> {
  const token = process.env.GH_QA_TOKEN;
  const repo = process.env.GH_QA_REPO;
  const branch = process.env.GH_QA_BRANCH || "main";
  if (!token || !repo) return; // silently skip when not configured

  const tsIso = typeof c.ts === "string" ? c.ts : new Date(c.ts).toISOString();
  const tsForFile = tsIso.replace(/:/g, "-").replace(/\..+$/, "Z");
  const shortId = c.id.slice(-8);
  const path = `qa-comments/${tsForFile}--${safeSegment(c.itemId)}--${shortId}.json`;

  const payload = {
    id: c.id,
    itemId: c.itemId,
    tester: c.tester,
    userId: c.userId ?? null,
    status: c.status,
    note: c.note,
    screenshotUrl: c.screenshotUrl ?? null,
    ts: tsIso,
  };
  const contentB64 = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");

  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const body = {
    message: `qa: feedback from @${c.tester} on ${c.itemId}`,
    content: contentB64,
    branch,
  };

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("mirrorCommentToRepo failed", res.status, text.slice(0, 200));
    }
  } catch (e) {
    console.error("mirrorCommentToRepo error", e);
  }
}

// Loaded once per deployment from `qa-processed.json` at the repo root via
// fs.readFile in route handlers. Shape:
//   {
//     "processedIds": {
//       "<commentId>": { "ts": "ISO date", "sha": "abc1234", "summary": "…" }
//     }
//   }
export type ProcessedManifest = {
  processedIds: Record<string, { ts: string; sha?: string; summary?: string }>;
};
