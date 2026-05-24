// System notifications feed.
//
// A bundled list of admin/system messages users see in a pinned
// "📢 IRONLOG SYSTEM" pseudo-conversation at the top of the
// Messages inbox. Update this file to broadcast app changes,
// behavioural reminders, anti-cheat warnings, etc. — each deploy
// ships the updated feed.
//
// Read state is tracked client-side per-user in localStorage
// (key: `ironlog-system-notif-reads-v1`), keyed by notification id.
// Older notifications keep their unread-vs-read distinction across
// sessions; new entries (id never seen before) start unread.
//
// (qa: system-notifications-feed)

export type SystemNotification = {
  // Stable identifier — used for read tracking. NEVER change an id
  // once shipped; users would re-see the notification as unread.
  id: string;
  // 'info'    = grey accent, neutral copy (default).
  // 'update'  = teal accent, app changes / new features.
  // 'warning' = red accent, behavioural / anti-cheat / important.
  severity: "info" | "update" | "warning";
  title: string;
  body: string;
  // ISO date the notification was published. Surfaced on the bubble
  // and used for chronological sort (newest at the bottom of the
  // chat-style log, like a real conversation).
  publishedAt: string;
};

export const SYSTEM_NOTIFICATIONS: SystemNotification[] = [
  {
    id: "anti-cheat-warning-2026-05-24",
    severity: "warning",
    title: "Train honestly — anti-cheat warning",
    body:
      "Heads up: logging incorrect data to game your tier score (inflated weights, fake sessions, mis-tagged effort) can result in a sub-rank deduction in the affected dimension for a period of time.\n\n" +
      "Lift safe, track honestly, progress naturally. 💪",
    publishedAt: "2026-05-24T00:00:00Z",
  },
];

// Local-storage helpers — read state lives entirely on-device so
// notifications stay personalised per user without a DB round-trip.
const READ_KEY = "ironlog-system-notif-reads-v1";

export function readSystemNotifReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function markSystemNotifsRead(ids: string[] | "all"): void {
  if (typeof window === "undefined") return;
  try {
    const current = readSystemNotifReadIds();
    const toMark = ids === "all" ? SYSTEM_NOTIFICATIONS.map(n => n.id) : ids;
    for (const id of toMark) current.add(id);
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

// Unread count for the inbox-list badge. Counts notifications whose
// id isn't yet in the readIds set.
export function systemNotifUnreadCount(): number {
  const read = readSystemNotifReadIds();
  return SYSTEM_NOTIFICATIONS.filter(n => !read.has(n.id)).length;
}
