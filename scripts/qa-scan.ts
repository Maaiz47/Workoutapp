// scripts/qa-scan.ts
//
// QA-coverage sweep. Run this at the end of every QA pass (or any time you
// ship a feature) to make sure every change has a corresponding test item
// in qa-state.json. Run with:
//
//   npx tsx scripts/qa-scan.ts
//
// What it does:
//   1. Reads every `(qa: <id>[, <id>...])` tag in PATCHLOG.md.
//   2. Reads every item.id in qa-state.json.
//   3. Flags any tag with no matching item ("orphan tag" → forgot to add
//      the test item).
//   4. Flags any recent PATCHLOG section heading that contains no
//      `(qa: ...)` tag at all (likely a feature shipped without coverage).
//
// Exits non-zero if there are gaps so this can gate CI later.

import fs from "fs";
import path from "path";

const REPO_ROOT = process.cwd();
const PATCHLOG = path.join(REPO_ROOT, "PATCHLOG.md");
const QA_STATE = path.join(REPO_ROOT, "qa-state.json");

interface QAItem { id: string; title: string }
interface QAState { items: QAItem[] }

function readPatchlog(): string {
  return fs.readFileSync(PATCHLOG, "utf-8");
}

function readQaState(): QAState {
  return JSON.parse(fs.readFileSync(QA_STATE, "utf-8")) as QAState;
}

interface Section { heading: string; body: string; tags: string[] }

// Split PATCHLOG into sections (each `## …` line starts a new one). For each
// section, extract any `(qa: a, b, c)` tags found anywhere inside it.
function parseSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), body: "", tags: [] };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);

  const tagRe = /\(qa:\s*([^)]+)\)/gi;
  // Strip inline code spans + fenced blocks so example tags inside backticks
  // don't get picked up as real references.
  const stripCode = (s: string) => s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "");
  for (const s of sections) {
    const haystack = stripCode(s.heading) + "\n" + stripCode(s.body);
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(haystack)) !== null) {
      for (const id of m[1].split(",")) {
        const trimmed = id.trim();
        if (trimmed) s.tags.push(trimmed);
      }
    }
  }
  return sections;
}

// Headings that look like work-shipping entries (QA passes or Feature
// additions). Older sections like "Environment Variables" are
// infrastructure notes, not features, so they're excluded from the
// coverage check.
function isFeatureSection(heading: string): boolean {
  return /^(QA pass|Feature)\b/i.test(heading);
}

function main() {
  const md = readPatchlog();
  const state = readQaState();
  const validIds = new Set(state.items.map(i => i.id));

  const sections = parseSections(md);
  const recent = sections.filter(s => isFeatureSection(s.heading)).slice(0, 5);

  const orphanTags = new Set<string>();
  const untaggedSections: string[] = [];

  for (const s of recent) {
    if (s.tags.length === 0) untaggedSections.push(s.heading);
    for (const tag of s.tags) {
      if (!validIds.has(tag)) orphanTags.add(tag);
    }
  }

  const strict = process.argv.includes("--strict");
  let fail = false;
  let warned = false;
  console.log("── QA coverage sweep ──");
  console.log(`Scanned ${recent.length} recent feature/pass sections.`);
  console.log(`qa-state.json has ${validIds.size} tracked items.${strict ? " [strict mode]" : ""}\n`);

  if (orphanTags.size > 0) {
    fail = true;
    console.log("✗ Orphan (qa: …) tags — referenced in PATCHLOG but missing from qa-state.json:");
    for (const t of orphanTags) console.log(`    - ${t}`);
    console.log("  → Add a matching item to qa-state.json so this feature is testable.\n");
  }

  if (untaggedSections.length > 0) {
    warned = true;
    const marker = strict ? "✗" : "⚠";
    console.log(`${marker} PATCHLOG sections with no (qa: …) tag:`);
    for (const h of untaggedSections) console.log(`    - ${h}`);
    console.log("  → Tag the entry with the qa-state item it addresses (e.g. `(qa: workout-rest-timer)`),");
    console.log("    or add a new item to qa-state.json if the feature wasn't tracked before.\n");
    if (strict) fail = true;
  }

  if (!fail && !warned) {
    console.log("✓ All recent PATCHLOG entries are tagged and all tags resolve. No gaps.");
  } else if (!fail) {
    console.log("(No hard failures. Run with --strict to escalate warnings to errors.)");
  }

  process.exit(fail ? 1 : 0);
}

main();
