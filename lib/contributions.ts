// Contributors catalogue — credits-style record of who's helped move
// IronLog forward. Surfaced on the Contributions leaderboard (see
// view: "contributions" in app/page.tsx) and any future "About / Credits"
// surface.
//
// Add a new contributor by appending to CONTRIBUTORS. The `username`
// field SHOULD match a real User.username so the view can cross-link
// to a profile (or soft-attribute QA comments if logged out).
//
// (qa: contributions-leaderboard)

export type ContributionKind =
  | "asset-generation"   // image art, audio, etc.
  | "qa-feedback"        // bug reports, regression catches
  | "code"               // patches / PRs
  | "design"             // UI / UX work
  | "other";

export type Contribution = {
  kind: ContributionKind;
  description: string;
  // Count for sorting + leaderboard headline (e.g. 80 images, 12 QA notes).
  // Defaults to 1 if omitted.
  count?: number;
  // ISO date the contribution landed. Optional — for ordering or "added X"
  // labels in the future.
  at?: string;
};

export type Contributor = {
  username: string;       // matches User.username when the contributor has an account
  displayName: string;    // shown in the UI
  contributions: Contribution[];
};

export const CONTRIBUTORS: Contributor[] = [
  {
    username: "Amanii",
    displayName: "Amanii",
    contributions: [
      {
        kind: "asset-generation",
        description: "Generated all 80 image assets — 30 profile avatars (tier-unlocked + lucky-drop pool) and 50 form-demo frames covering the 7 stretches + 19 exercises the open library couldn't supply.",
        count: 80,
        at: "2026-05-22",
      },
      {
        kind: "qa-feedback",
        description: "Early QA pass on the auth + onboarding flow (Register, Login, Must-Reset).",
        count: 4,
        at: "2026-05-21",
      },
    ],
  },
];

// Total contribution count for leaderboard sorting. Sums the `count` of
// every contribution (default 1 when count is omitted).
export function totalContributions(c: Contributor): number {
  return c.contributions.reduce((sum, x) => sum + (x.count ?? 1), 0);
}

// Sorted descending by total contribution count.
export function rankedContributors(): Contributor[] {
  return [...CONTRIBUTORS].sort((a, b) => totalContributions(b) - totalContributions(a));
}

// Human label for a contribution kind — shown as a small chip in the UI.
export function kindLabel(k: ContributionKind): { icon: string; label: string; color: string } {
  switch (k) {
    case "asset-generation": return { icon: "🎨", label: "ART",   color: "#a855f7" };
    case "qa-feedback":      return { icon: "🐞", label: "QA",    color: "#4ECDC4" };
    case "code":             return { icon: "💻", label: "CODE",  color: "#fbbf24" };
    case "design":           return { icon: "✏️", label: "DESIGN",color: "#FF6B6B" };
    case "other":            return { icon: "✨", label: "OTHER", color: "#94a3b8" };
  }
}
