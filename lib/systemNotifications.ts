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

// ── DYNAMIC NOTIFICATIONS (user-specific) ────────────────────────────
//
// Per @maaiz: 'System notification to users who report a bug through
// app when it's patched. Same for if they submit an idea and if it
// gets approved.' Fetched from /api/qa/comments/mine on app load and
// merged with the bundled list above. Acks tracked separately so
// dynamic ones don't pollute the bundled-feed reads.
//
// (qa: qa-patch-notification)

const PATCH_NOTIF_ACK_KEY = "ironlog-qa-patch-acks-v1";

export type PatchNotification = {
  id: string;             // qa-comment id — used as the dynamic notif id
  itemId: string;         // QA item the comment was filed against
  title: string;          // synthesised from the item + status
  body: string;           // server summary if available, else fallback
  publishedAt: string;    // processedAt ISO
  isIdea: boolean;        // 'idea' if note prefix includes 💡; else 'bug'
};

export type CommentMine = {
  id: string;
  itemId: string;
  status: string;
  note: string;
  ts: string;
  processed: boolean;
  processedAt: string | null;
  processedSummary: string | null;
};

function readPatchAcks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PATCH_NOTIF_ACK_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markPatchNotifsRead(ids: string[] | "all", allDynamicIds?: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = readPatchAcks();
    if (ids === "all") {
      for (const id of allDynamicIds ?? []) current.add(id);
    } else {
      for (const id of ids) current.add(id);
    }
    localStorage.setItem(PATCH_NOTIF_ACK_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

// Fetch the user's own processed QA comments and turn each into a
// PatchNotification card. Returns [] if not authed or none processed.
export async function fetchPatchNotifications(): Promise<PatchNotification[]> {
  try {
    const r = await fetch("/api/qa/comments/mine", { credentials: "same-origin" });
    if (!r.ok) return [];
    const data = await r.json();
    const list: CommentMine[] = data?.comments ?? [];
    return list
      .filter(c => c.processed && c.processedAt)
      .map(c => {
        // Note bodies are tagged by the client with a prefix like
        // "[🐞 BUG · area · view=foo]" or "[💡 IDEA · ...]". Detect
        // the type so the notification body reads naturally.
        const isIdea = /\[💡\s*IDEA/.test(c.note) || /💡/.test(c.note);
        const title = isIdea
          ? "💡 Your idea shipped"
          : "🐞 Your bug report is patched";
        const body = c.processedSummary
          ? `${c.processedSummary}\n\nTap to view the QA item.`
          : `We just shipped a fix for the report you filed on '${c.itemId}'. Tap to view the QA item.`;
        return {
          id: c.id,
          itemId: c.itemId,
          title,
          body,
          publishedAt: c.processedAt ?? new Date().toISOString(),
          isIdea,
        };
      });
  } catch {
    return [];
  }
}

// Combined unread count (bundled + dynamic patches the user hasn't
// ack'd yet). Used by the Messages inbox badge.
export async function combinedSystemNotifUnreadCount(): Promise<number> {
  const bundledRead = readSystemNotifReadIds();
  const bundledUnread = SYSTEM_NOTIFICATIONS.filter(n => !bundledRead.has(n.id)).length;
  const patches = await fetchPatchNotifications();
  const patchAcks = readPatchAcks();
  const patchUnread = patches.filter(p => !patchAcks.has(p.id)).length;
  return bundledUnread + patchUnread;
}
