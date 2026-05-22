// Generates placeholder demo frames for the 7 stretches that don't have
// custom photo assets yet. Renders an SVG → PNG (saved as 0.png / 1.png)
// per stretch. The placeholders show the stretch name + a START / END
// frame description on a black background — they alternate at 900ms in
// the FORM modal so the user reads "what's happening" through the
// animation. Replace any pair with real photos by dropping a 0.png/1.png
// pair in the matching folder (extension is now PNG everywhere).
//
// Run with `npx tsx scripts/generate-stretch-placeholders.ts`.

import { Resvg } from "@resvg/resvg-js";
import * as fs from "fs";
import * as path from "path";

type Frame = { headline: string; body: string };
type Spec = { id: string; title: string; emoji: string; frames: [Frame, Frame] };

const SPECS: Spec[] = [
  // ── Stretches / warmups (no demo in free-exercise-db) ──
  {
    id: "cd-chest-doorway", title: "Doorway Chest Stretch", emoji: "🚪",
    frames: [
      { headline: "START", body: "Stand in doorway. Forearm against\nframe at shoulder height. Squared up." },
      { headline: "STRETCH", body: "Rotate torso away from contact arm.\nStep front foot through. Hold 30s." },
    ],
  },
  {
    id: "cd-pigeon", title: "Pigeon Pose", emoji: "🧘",
    frames: [
      { headline: "SETUP", body: "Right shin bent in front, parallel\nto mat. Hands flanking hips. Tall." },
      { headline: "SINK", body: "Hips drop to mat. Torso folds over\nfront shin. Forearms rest. Hold 45s." },
    ],
  },
  {
    id: "cd-hamstring-lay", title: "Lying Hamstring Stretch", emoji: "🦵",
    frames: [
      { headline: "SETUP", body: "On back. Right foot in band/strap.\nLeg raised about 60° from floor." },
      { headline: "PULL", body: "Pull leg toward chest to ~90°.\nKnee soft, hips on floor. 30s." },
    ],
  },
  {
    id: "cd-lat-stretch", title: "Overhead Lat Stretch", emoji: "🙆",
    frames: [
      { headline: "REACH", body: "Stand tall. Right arm overhead,\nhand reaching up. Left at side." },
      { headline: "BEND", body: "Left hand grabs right wrist.\nLean left ~25°. Feel right side." },
    ],
  },
  {
    id: "cd-glute-pretzel", title: "Figure-Four Glute Stretch", emoji: "🪢",
    frames: [
      { headline: "SETUP", body: "On back, knees bent. Right ankle\nover left knee. Right knee opens." },
      { headline: "PULL", body: "Hands clasp behind left thigh.\nPull toward chest. Hold 30s/side." },
    ],
  },
  {
    id: "wu-leg-swings", title: "Leg Swings", emoji: "🦵",
    frames: [
      { headline: "FORWARD", body: "Stand side-on, hand on wall.\nSwing leg forward to ~45°." },
      { headline: "BACK", body: "Swing same leg backward to ~30°.\nKeep core braced. 10/side." },
    ],
  },
  {
    id: "wu-scap-shrugs", title: "Scap Push-Ups", emoji: "🛡",
    frames: [
      { headline: "RETRACT", body: "High plank, elbows locked.\nPinch shoulder blades together." },
      { headline: "PROTRACT", body: "Push shoulder blades APART.\nUpper back rounds. 10 slow reps." },
    ],
  },

  // ── Plyometric / conditioning movements (no demo in free-exercise-db) ──
  {
    id: "bear-crawl", title: "Bear Crawl", emoji: "🐻",
    frames: [
      { headline: "SETUP", body: "Quadrupedal stance. Knees hover\n2-3\" off floor. Back flat." },
      { headline: "STEP", body: "Right hand + left foot extend\nforward together. Knees still up." },
    ],
  },
  {
    id: "broad-jump", title: "Broad Jump", emoji: "🦘",
    frames: [
      { headline: "LOAD", body: "Knees softly bent. Arms swung\nback. Loaded spring position." },
      { headline: "APEX", body: "Feet off the floor. Arms up.\nKnees tucked. Horizontal jump." },
    ],
  },
  {
    id: "elliptical", title: "Elliptical", emoji: "🏃",
    frames: [
      { headline: "STRIDE 1", body: "Hands on moving bars. Left foot\nforward on pedal, right back." },
      { headline: "STRIDE 2", body: "Switched — right foot forward,\nleft back. Smooth stride pattern." },
    ],
  },
  {
    id: "inchworm", title: "Inchworm Walkout", emoji: "🐛",
    frames: [
      { headline: "FORWARD FOLD", body: "Feet together. Hinge at hips.\nHands touch floor at feet." },
      { headline: "PLANK", body: "Walk hands forward to plank.\nHold 1 sec, walk feet back." },
    ],
  },
  {
    id: "lateral-bounds", title: "Lateral Bounds", emoji: "⛸",
    frames: [
      { headline: "LOAD", body: "Balanced on right leg. Left leg\nlifted slightly. Arms swung right." },
      { headline: "BOUND", body: "Mid-air sideways leap left.\nArms swung opposite way." },
    ],
  },
  {
    id: "lateral-shuffle", title: "Lateral Shuffle", emoji: "👣",
    frames: [
      { headline: "STANCE", body: "Athletic stance. Feet shoulder-\nwidth. Knees slightly bent." },
      { headline: "SHUFFLE", body: "Step out with right foot. Left\nfollows. Stay low, face forward." },
    ],
  },
  {
    id: "plyo-pushup", title: "Plyo Push-Up", emoji: "💥",
    frames: [
      { headline: "BOTTOM", body: "Push-up bottom. Elbows bent ~90°.\nChest hovers an inch off floor." },
      { headline: "AIR", body: "Hands launch off the floor.\n~6\" of air. Body still in plank." },
    ],
  },
  {
    id: "speed-skaters", title: "Speed Skaters", emoji: "⛷",
    frames: [
      { headline: "RIGHT", body: "Balanced on right leg. Left toe\ntaps behind. Reach across right." },
      { headline: "LEFT", body: "Mirror — left leg, right tap.\nFlow side to side. 30s total." },
    ],
  },
  {
    id: "split-jumps", title: "Split Jumps", emoji: "🏃",
    frames: [
      { headline: "LUNGE", body: "Right foot forward, left back.\nBoth knees bent ~90°." },
      { headline: "SWITCH", body: "Mid-air scissor. Feet swap mid-\njump. Land in mirror lunge." },
    ],
  },
  {
    id: "squat-thrust", title: "Squat Thrust", emoji: "💢",
    frames: [
      { headline: "SQUAT", body: "Hands on floor between feet.\nDeep squat. Knees outside elbows." },
      { headline: "PLANK", body: "Kick feet back to plank.\nBody straight. Hands under shoulders." },
    ],
  },
  {
    id: "star-jump", title: "Star Jump", emoji: "✨",
    frames: [
      { headline: "CROUCH", body: "Tight crouch. Feet together.\nArms tucked at chest." },
      { headline: "STAR", body: "Mid-air X-shape. Arms up-and-\nout. Legs splayed. Feet off floor." },
    ],
  },
  {
    id: "tuck-jumps", title: "Tuck Jumps", emoji: "⬆",
    frames: [
      { headline: "STAND", body: "Standing tall. Slight knee bend.\nArms at sides. Eyes forward." },
      { headline: "TUCK", body: "Mid-air. Knees high to chest.\nHands lightly touch shins." },
    ],
  },

  // ── Wrong-mapped (previously pointed to unrelated DB exercise) ──
  {
    id: "jumping-jacks", title: "Jumping Jacks", emoji: "🤸",
    frames: [
      { headline: "STAND", body: "Stand tall. Feet together.\nArms at sides." },
      { headline: "JACK", body: "Jump feet wide while arms\nswing overhead. Clap or near-clap." },
    ],
  },
  {
    id: "burpees", title: "Burpee", emoji: "🔥",
    frames: [
      { headline: "PUSH-UP", body: "Bottom of a push-up.\nChest near the floor." },
      { headline: "JUMP", body: "Jump up with arms overhead.\nFull extension. Reset and repeat." },
    ],
  },
  {
    id: "high-knees", title: "High Knees", emoji: "🏃",
    frames: [
      { headline: "RIGHT", body: "Running in place. Right knee\ndriven high — at or above hip." },
      { headline: "LEFT", body: "Alternate — left knee up,\nright down. Pump arms. Fast turnover." },
    ],
  },
  {
    id: "wall-sit", title: "Wall Sit", emoji: "🪑",
    frames: [
      { headline: "SETUP", body: "Back flat against wall.\nFeet shoulder-width, ~2 ft out." },
      { headline: "HOLD", body: "Slide down — knees bent 90°.\nHold 30-60 sec. Don't lean off." },
    ],
  },
  {
    id: "wall-slide", title: "Wall Slide", emoji: "🧱",
    frames: [
      { headline: "DOWN", body: "Back + forearms on wall.\nArms bent in goalpost shape." },
      { headline: "UP", body: "Slide arms up the wall until\nfully extended overhead. Keep wrists on wall." },
    ],
  },
  {
    id: "terminal-knee-extension", title: "Terminal Knee Extension", emoji: "🦿",
    frames: [
      { headline: "BENT", body: "Band looped behind knee.\nStand tall. Knee slightly bent." },
      { headline: "STRAIGHT", body: "Extend knee fully against band.\nLock out. Hold 1 sec. 2×15." },
    ],
  },
  {
    id: "bird-dog", title: "Bird Dog", emoji: "🐦",
    frames: [
      { headline: "QUADRUPED", body: "On hands and knees. Wrists\nunder shoulders, knees under hips." },
      { headline: "EXTEND", body: "Reach right arm forward + left\nleg back. Hold 2 sec. Switch." },
    ],
  },
];

const SIZE = 600;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildSvg(spec: Spec, frame: 0 | 1): string {
  const f = spec.frames[frame];
  const stripe = frame === 0 ? "#4ECDC4" : "#FF6B6B";
  const headlineColor = frame === 0 ? "#4ECDC4" : "#FF6B6B";
  const bodyLines = f.body.split("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#15151a"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${stripe}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${stripe}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#halo)"/>

  <!-- Top stripe + frame indicator -->
  <rect x="0" y="0" width="${SIZE}" height="6" fill="${stripe}"/>
  <text x="${SIZE / 2}" y="${SIZE * 0.18}" text-anchor="middle" font-family="monospace" font-size="22" letter-spacing="6" fill="${headlineColor}" font-weight="700">FRAME ${frame + 1} OF 2</text>

  <!-- Emoji glyph - large central -->
  <text x="${SIZE / 2}" y="${SIZE * 0.50}" text-anchor="middle" font-size="180" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${spec.emoji}</text>

  <!-- Stretch title -->
  <text x="${SIZE / 2}" y="${SIZE * 0.66}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#ffffff" font-weight="700">${escapeXml(spec.title)}</text>

  <!-- Frame headline (START/STRETCH/etc.) -->
  <text x="${SIZE / 2}" y="${SIZE * 0.73}" text-anchor="middle" font-family="monospace" font-size="18" letter-spacing="3" fill="${headlineColor}" font-weight="700">▸ ${escapeXml(f.headline)}</text>

  <!-- Body lines (instruction) -->
  ${bodyLines.map((line, i) => `<text x="${SIZE / 2}" y="${SIZE * 0.80 + i * 26}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">${escapeXml(line)}</text>`).join("\n  ")}

  <!-- Placeholder watermark (top-right) -->
  <text x="${SIZE - 14}" y="${SIZE - 14}" text-anchor="end" font-family="monospace" font-size="11" letter-spacing="2" fill="rgba(255,255,255,0.25)" font-weight="600">PLACEHOLDER · v1</text>
</svg>`;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFrame(spec: Spec, frame: 0 | 1) {
  const dir = path.join(process.cwd(), "public", "stretches", spec.id);
  ensureDir(dir);
  const svg = buildSvg(spec, frame);
  const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
  const png = resvg.render().asPng();
  const out = path.join(dir, `${frame}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ ${out} (${(png.length / 1024).toFixed(1)} KB)`);
}

for (const spec of SPECS) {
  writeFrame(spec, 0);
  writeFrame(spec, 1);
}
console.log(`\nDone. ${SPECS.length * 2} placeholder frames across ${SPECS.length} movements.`);
