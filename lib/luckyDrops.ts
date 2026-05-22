// Random rare rewards — variable-reward dopamine drops awarded after
// a successful workout save. Two reward shapes:
//   1. tier-score bonus (small numeric bump on the headline athlete score)
//   2. lucky avatar drop (a cosmetic unlock from the rare pool)
// (qa: random-rare-rewards)
//
// Anti-grind: max one lucky drop per 24h per user. Persisted on
// UserProfile.lastLuckyDropAt and checked here.

import { LUCKY_AVATAR_POOL, Avatar } from "./avatars";

export type LuckyDrop =
  | { kind: "score-bonus"; amount: number; flavour: string }
  | { kind: "avatar"; avatar: Avatar; flavour: string }
  | null;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ROLL_CHANCE = 0.20;          // 1-in-5 sessions are eligible (subject to cooldown)
const AVATAR_VS_SCORE_SPLIT = 0.35; // 35% of eligible drops are avatars (if any unlockable left)
const MAX_LIFETIME_BONUS = 20;     // cap on cumulative tier-score bonus
const SCORE_BONUS_MIN = 1;
const SCORE_BONUS_MAX = 5;

const SCORE_FLAVOURS = [
  "🍀 Lucky lift — +{amount} to your tier score.",
  "✨ Hot hand — the lottery just paid out (+{amount}).",
  "🌟 Bonus drop — your tier score went up (+{amount}).",
  "💫 A small spark — +{amount} on the headline.",
  "⚡ Score bump — +{amount} from the lucky pool.",
];

export type LuckyContext = {
  // Current cumulative bonus (cap-aware).
  currentBonus: number;
  // Avatar ids the user already has from the lucky pool.
  ownedLuckyAvatarIds: Set<string>;
  // Last drop timestamp (ms) or null for never.
  lastDropAt: number | null;
};

// Returns null when no drop fires (most sessions). When it fires,
// returns a description of what was won. The caller is responsible
// for persisting the change to UserProfile / UserAvatarUnlock and
// the new lastLuckyDropAt.
export function rollLuckyDrop(ctx: LuckyContext, now: number = Date.now()): LuckyDrop {
  // Cooldown gate.
  if (ctx.lastDropAt && now - ctx.lastDropAt < COOLDOWN_MS) return null;
  // Roll for eligibility.
  if (Math.random() > ROLL_CHANCE) return null;

  const remainingLucky = LUCKY_AVATAR_POOL.filter(a => !ctx.ownedLuckyAvatarIds.has(a.id));
  const bonusRoomLeft = MAX_LIFETIME_BONUS - ctx.currentBonus;
  const canDropAvatar = remainingLucky.length > 0;
  const canDropScore = bonusRoomLeft >= SCORE_BONUS_MIN;
  if (!canDropAvatar && !canDropScore) return null;

  const wantAvatar = canDropAvatar && (!canDropScore || Math.random() < AVATAR_VS_SCORE_SPLIT);
  if (wantAvatar) return pickAvatar(remainingLucky);
  return pickScoreBonus(bonusRoomLeft);
}

function pickScoreBonus(maxAmount: number): LuckyDrop {
  const ceiling = Math.min(SCORE_BONUS_MAX, Math.max(SCORE_BONUS_MIN, maxAmount));
  const amount = Math.floor(SCORE_BONUS_MIN + Math.random() * (ceiling - SCORE_BONUS_MIN + 1));
  const flavour = SCORE_FLAVOURS[Math.floor(Math.random() * SCORE_FLAVOURS.length)].replace("{amount}", String(amount));
  return { kind: "score-bonus", amount, flavour };
}

function pickAvatar(pool: Avatar[]): LuckyDrop {
  // Weighted pick by luckyWeight.
  const total = pool.reduce((s, a) => s + (a.luckyWeight ?? 10), 0);
  let pick = Math.random() * total;
  for (const a of pool) {
    pick -= (a.luckyWeight ?? 10);
    if (pick <= 0) {
      return { kind: "avatar", avatar: a, flavour: `🎁 Rare drop — ${a.name}. ${a.flavour}` };
    }
  }
  const fallback = pool[pool.length - 1];
  return { kind: "avatar", avatar: fallback, flavour: `🎁 Rare drop — ${fallback.name}. ${fallback.flavour}` };
}
