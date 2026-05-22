// Avatar catalogue — profile pictures users can equip. Each avatar is
// either unlocked deterministically when the user reaches a tier
// (source="tier") or as a random "lucky drop" reward after a workout
// (source="lucky"). The rare-pool avatars are mostly cosmetic, not
// power — they don't change tier score, just give the user a
// collectable to chase. (qa: profile-avatars, random-rare-rewards)

export type AvatarSource = "tier" | "lucky";

export type Avatar = {
  id: string;            // stable, never reused — used as filename: /avatars/<id>.png
  name: string;          // short display name
  source: AvatarSource;
  // For source="tier": the tier the user must reach to unlock (1-6).
  // For source="lucky": null (only obtainable via the lucky-drop roll).
  tier?: number;
  // Short flavour line shown when the avatar is awarded.
  flavour: string;
  // Rarity weight when rolling lucky drops. Higher = more common.
  // Only consulted for source="lucky" rows. Default 10.
  luckyWeight?: number;
};

// 20 tier-unlocked avatars — 3-4 per tier so users have a few to
// equip at each rung. Tier 1 avatars are unlocked automatically the
// first time the user opens the avatar picker (handled server-side
// by /api/avatars POST when source="tier" rows are missing).
const TIER_AVATARS: Avatar[] = [
  // Tier 1 (Kitten / Bronze) — gentle starting pack
  { id: "starter-spark",     name: "Starter Spark",     source: "tier", tier: 1, flavour: "Every climb begins with one step." },
  { id: "starter-dawn",      name: "Quiet Dawn",        source: "tier", tier: 1, flavour: "Show up. The rest follows." },
  { id: "starter-seedling",  name: "Seedling",          source: "tier", tier: 1, flavour: "Patience is a muscle too." },

  // Tier 2 (Fox / Silver) — sharpening
  { id: "fox-sprint",        name: "Sharp Sprint",      source: "tier", tier: 2, flavour: "You found the rhythm." },
  { id: "fox-emberbolt",     name: "Emberbolt",         source: "tier", tier: 2, flavour: "Quick on the rep, quicker on the next." },
  { id: "fox-stride",        name: "Steady Stride",     source: "tier", tier: 2, flavour: "Consistent. Patient. Dangerous." },

  // Tier 3 (Big Dawg / Gold) — formidable
  { id: "dawg-howler",       name: "Howler",            source: "tier", tier: 3, flavour: "Loud lifts, louder PRs." },
  { id: "dawg-ironpaw",      name: "Iron Paw",          source: "tier", tier: 3, flavour: "Earned every kilo." },
  { id: "dawg-watcher",      name: "The Watcher",       source: "tier", tier: 3, flavour: "Always one rep ahead of yesterday." },

  // Tier 4 (Lion / Platinum) — commanding
  { id: "lion-crown",        name: "Crowned",           source: "tier", tier: 4, flavour: "The bar bows to you." },
  { id: "lion-mane",         name: "Mane Event",        source: "tier", tier: 4, flavour: "You don't chase tiers. They chase you." },
  { id: "lion-thunder",      name: "Thunderpride",      source: "tier", tier: 4, flavour: "Roar earned, not given." },

  // Tier 5 (Gorilla / Diamond) — towering
  { id: "gorilla-titan",     name: "Titan Form",        source: "tier", tier: 5, flavour: "Mountains move now." },
  { id: "gorilla-stoneheart",name: "Stoneheart",        source: "tier", tier: 5, flavour: "Unmoved by the weight. Or anything else." },
  { id: "gorilla-vanguard",  name: "Vanguard",          source: "tier", tier: 5, flavour: "Lead the lift. Lead the room." },

  // Tier 6 (Bear / Master) — apex
  { id: "bear-warden",       name: "Warden of Iron",    source: "tier", tier: 6, flavour: "The ladder bends to you." },
  { id: "bear-ursanova",     name: "Ursa Nova",         source: "tier", tier: 6, flavour: "Apex on the floor, apex on the scoreboard." },
  { id: "bear-eternal",      name: "Eternal Climb",     source: "tier", tier: 6, flavour: "Top of the mountain — still going." },
  { id: "bear-monolith",     name: "The Monolith",      source: "tier", tier: 6, flavour: "A single rep that echoes for years." },
  { id: "bear-pinnacle",     name: "Pinnacle",          source: "tier", tier: 6, flavour: "There's no rung above this one." },
];

// 10 rare lucky-drop-only avatars. Heavier weighting on the "almost
// common rare" entries so users see one occasionally; the truly rare
// drops (cosmic / mythic) keep the chase alive.
const LUCKY_AVATARS: Avatar[] = [
  { id: "lucky-clover",        name: "Lucky Clover",       source: "lucky", luckyWeight: 25, flavour: "A four-leafed PR." },
  { id: "lucky-shooting-star", name: "Shooting Star",      source: "lucky", luckyWeight: 22, flavour: "Streak of brilliance." },
  { id: "lucky-prism",         name: "Prism",              source: "lucky", luckyWeight: 18, flavour: "All your sub-ranks aligned. Briefly." },
  { id: "lucky-firefly",       name: "Firefly Pulse",      source: "lucky", luckyWeight: 15, flavour: "A small, bright surprise." },
  { id: "lucky-glacier",       name: "Glacier Heart",      source: "lucky", luckyWeight: 12, flavour: "Cool, rare, ancient." },
  { id: "lucky-aurora",        name: "Aurora",             source: "lucky", luckyWeight: 8,  flavour: "The sky bowed for one set." },
  { id: "lucky-phoenix",       name: "Phoenix Form",       source: "lucky", luckyWeight: 5,  flavour: "Reborn between sets." },
  { id: "lucky-eclipse",       name: "Eclipse",            source: "lucky", luckyWeight: 3,  flavour: "Total alignment. Once-in-a-lift." },
  { id: "lucky-cosmic",        name: "Cosmic Drift",       source: "lucky", luckyWeight: 2,  flavour: "Lifted to the stars." },
  { id: "lucky-mythic",        name: "Mythic Echo",        source: "lucky", luckyWeight: 1,  flavour: "Almost no one finds this one." },
];

export const AVATARS: Avatar[] = [...TIER_AVATARS, ...LUCKY_AVATARS];

export function findAvatar(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATARS.find(a => a.id === id) ?? null;
}

export function tierAvatarsAtOrBelow(tier: number): Avatar[] {
  return TIER_AVATARS.filter(a => (a.tier ?? 7) <= tier);
}

export const LUCKY_AVATAR_POOL: Avatar[] = LUCKY_AVATARS;
