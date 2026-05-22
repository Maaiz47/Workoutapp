// Bulk-image unpack helper. Takes a flat folder OR zip of images
// named with their target paths and routes each into the right
// /public/ destination. Lets a contributor (e.g. Amanii dropping
// the 82-image batch) hand over a single archive instead of
// manually placing each PNG.
//
// Usage:
//   npx tsx scripts/unpack-image-batch.ts <path>
//
// Where <path> is either:
//   - A directory containing files in the layout below, OR
//   - A .zip archive of the same layout (system `unzip` required)
//
// Expected layout inside the source:
//   avatars/<id>.png             → /public/avatars/<id>.png
//   stretches/<id>/0.png         → /public/stretches/<id>/0.png
//   stretches/<id>/1.png         → /public/stretches/<id>/1.png
//
// Any file outside that pattern is logged + skipped (not copied).
// Existing destination files are OVERWRITTEN — re-runs are
// idempotent and let you fix one image without re-importing the
// whole batch.

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const VALID_NAMES = new Set(["0.png", "1.png"]);

type RoutedFile = { src: string; dest: string };
type SkipReason = "wrong-prefix" | "stretch-bad-frame" | "not-png" | "deeper-than-expected";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full));
  }
  return out;
}

function unzipToTemp(zipPath: string): string {
  const tempDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "ironlog-unpack-"));
  console.log(`Unzipping ${zipPath} → ${tempDir}`);
  try {
    execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { stdio: "inherit" });
  } catch (e) {
    console.error("Failed to unzip. Is `unzip` installed?");
    throw e;
  }
  return tempDir;
}

function route(relPath: string): RoutedFile | { skip: SkipReason; relPath: string } {
  if (!relPath.toLowerCase().endsWith(".png")) return { skip: "not-png", relPath };
  // Normalise path separators (zip may produce forward slashes on Windows).
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  if (parts[0] === "avatars" && parts.length === 2) {
    return { src: relPath, dest: path.join(PUBLIC_DIR, "avatars", parts[1]) };
  }
  if (parts[0] === "stretches" && parts.length === 3) {
    if (!VALID_NAMES.has(parts[2])) return { skip: "stretch-bad-frame", relPath };
    return { src: relPath, dest: path.join(PUBLIC_DIR, "stretches", parts[1], parts[2]) };
  }
  if (parts[0] === "avatars" || parts[0] === "stretches") {
    return { skip: "deeper-than-expected", relPath };
  }
  return { skip: "wrong-prefix", relPath };
}

function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: npx tsx scripts/unpack-image-batch.ts <directory-or-zip>");
    process.exit(1);
  }
  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Path not found: ${inputPath}`);
    process.exit(1);
  }

  let srcDir: string;
  let cleanup: (() => void) | null = null;
  const stat = fs.statSync(inputPath);
  if (stat.isFile() && inputPath.toLowerCase().endsWith(".zip")) {
    srcDir = unzipToTemp(inputPath);
    cleanup = () => { try { fs.rmSync(srcDir, { recursive: true, force: true }); } catch {} };
  } else if (stat.isDirectory()) {
    srcDir = inputPath;
  } else {
    console.error("Input must be a directory or a .zip file.");
    process.exit(1);
  }

  const files = walk(srcDir);
  const routed: RoutedFile[] = [];
  const skipped: { relPath: string; reason: SkipReason }[] = [];
  for (const f of files) {
    const r = route(f);
    if ("skip" in r) skipped.push({ relPath: r.relPath, reason: r.skip });
    else routed.push(r);
  }

  console.log(`\nFound ${files.length} files. Routing ${routed.length}, skipping ${skipped.length}.\n`);

  let avatarCount = 0;
  let stretchCount = 0;
  for (const r of routed) {
    ensureDir(path.dirname(r.dest));
    fs.copyFileSync(path.join(srcDir, r.src), r.dest);
    const rel = path.relative(process.cwd(), r.dest);
    if (rel.includes("avatars/")) avatarCount++;
    else if (rel.includes("stretches/")) stretchCount++;
    console.log(`  ✓ ${r.src.padEnd(36)} → ${rel}`);
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped:`);
    for (const s of skipped) console.log(`  - ${s.relPath} (${s.reason})`);
  }

  console.log(`\nDone. Avatars: ${avatarCount} · Stretches/exercises: ${stretchCount}`);
  console.log(`\nNext steps:`);
  console.log(`  git status                                              # see what changed`);
  console.log(`  git add public/avatars public/stretches                 # stage the new images`);
  console.log(`  git commit -m "chore: import image batch"               # commit`);
  console.log(`  git push origin main                                    # ship`);

  if (cleanup) cleanup();
}

main();
