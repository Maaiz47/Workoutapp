// scripts/tutorial-scan.ts
//
// Tutorial-coverage sweep — the automatic guard that keeps the in-app
// tutorial in step with the app as features ship. Run it alongside
// qa:scan before any deploy:
//
//   npx tsx scripts/tutorial-scan.ts        (warn)
//   npx tsx scripts/tutorial-scan.ts --strict   (fail on gaps — for CI)
//
// What it does:
//   1. Splits PATCHLOG.md into sections.
//   2. Looks at the most-recent FEATURE sections (headings starting
//      "Feat"/"Feature" — fixes to existing surfaces are exempt).
//   3. Flags any feature whose body never mentions the tutorial. The
//      forcing rule (docs/feature-forcing-rules.md) requires every
//      shipped user-facing feature to EITHER add/update a TUTORIAL_STEPS
//      entry OR state explicitly why none is needed (purely internal).
//      Either way the word "tutorial"/"TUTORIAL_STEPS" must appear, so
//      its absence means the author never considered coverage.
//   4. Sanity-checks lib/tutorial.ts: TUTORIAL_VERSION is present and
//      every step has id + title + body.
//
// This is deliberately a light heuristic — it can't tell whether the
// RIGHT step was added, only that tutorial coverage was consciously
// addressed on every feature. That's enough to stop the silent drift
// the audit found (10+ surfaces shipped with no step).

import fs from "fs";
import path from "path";

const REPO_ROOT = process.cwd();
const PATCHLOG = path.join(REPO_ROOT, "PATCHLOG.md");
const TUTORIAL = path.join(REPO_ROOT, "lib", "tutorial.ts");

interface Section { heading: string; body: string }

function parseSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

// Only FEATURE sections must justify tutorial coverage. Fixes / chores /
// QA passes touch existing surfaces and are exempt.
function isFeatureSection(heading: string): boolean {
  return /^(Feat|Feature)\b/i.test(heading);
}

function mentionsTutorial(body: string): boolean {
  return /tutorial|TUTORIAL_STEPS/i.test(body);
}

function checkTutorialFile(): string[] {
  const errs: string[] = [];
  const src = fs.readFileSync(TUTORIAL, "utf-8");
  if (!/export const TUTORIAL_VERSION\s*=/.test(src)) {
    errs.push("lib/tutorial.ts is missing an exported TUTORIAL_VERSION.");
  }
  // Count step objects + minimally validate each has id/title/body keys.
  const idCount = (src.match(/\bid:\s*["'][^"']+["']/g) || []).length;
  const titleCount = (src.match(/\btitle:\s*["'`]/g) || []).length;
  const bodyCount = (src.match(/\bbody:\s*["'`]/g) || []).length;
  if (idCount === 0 || titleCount === 0 || bodyCount === 0) {
    errs.push("lib/tutorial.ts: could not find step id/title/body fields — is TUTORIAL_STEPS intact?");
  }
  if (titleCount !== bodyCount) {
    errs.push(`lib/tutorial.ts: ${titleCount} titles vs ${bodyCount} bodies — a step may be missing a field.`);
  }
  return errs;
}

function main() {
  const strict = process.argv.includes("--strict");
  const md = fs.readFileSync(PATCHLOG, "utf-8");
  const sections = parseSections(md);
  const recentFeatures = sections.filter(s => isFeatureSection(s.heading)).slice(0, 8);

  const uncovered = recentFeatures.filter(s => !mentionsTutorial(s.body)).map(s => s.heading);
  const fileErrs = checkTutorialFile();

  console.log("── Tutorial coverage sweep ──");
  console.log(`Scanned the ${recentFeatures.length} most-recent FEATURE sections.${strict ? " [strict mode]" : ""}\n`);

  let fail = false;
  let warned = false;

  if (fileErrs.length > 0) {
    fail = true;
    console.log("✗ lib/tutorial.ts problems:");
    for (const e of fileErrs) console.log(`    - ${e}`);
    console.log();
  }

  if (uncovered.length > 0) {
    warned = true;
    const marker = strict ? "✗" : "⚠";
    console.log(`${marker} Feature PATCHLOG sections that never mention the tutorial:`);
    for (const h of uncovered) console.log(`    - ${h}`);
    console.log("  → Add a step to TUTORIAL_STEPS in lib/tutorial.ts for the new surface");
    console.log("    (and bump TUTORIAL_VERSION for a major arc), OR state in the PATCHLOG");
    console.log("    entry that no step is needed because the change is purely internal.\n");
    if (strict) fail = true;
  }

  if (!fail && !warned) {
    console.log("✓ Every recent feature addresses tutorial coverage, and lib/tutorial.ts is well-formed.");
  } else if (!fail) {
    console.log("(No hard failures. Run with --strict to escalate warnings to errors.)");
  }

  process.exit(fail ? 1 : 0);
}

main();
