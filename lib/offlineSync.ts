// Offline sync queue — wraps the workout-save POST so a failed network
// call (or no connection at all) stashes the payload in localStorage and
// replays it when the user comes back online.
//
// Why client-side: the PWA already runs without a service-worker fetch
// handler. This is a thin reliability layer for the one network call the
// user really hates losing — the workout save at session end.

const QUEUE_KEY = "ironlog-offline-queue-v1";

export type QueuedSave = {
  id: string;          // local id so we don't double-queue
  endpoint: string;    // e.g. "/api/workout"
  method: "POST" | "PUT";
  body: any;
  queuedAtIso: string;
  attempts: number;
};

function readQueue(): QueuedSave[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); }
  catch { return []; }
}

function writeQueue(q: QueuedSave[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

export function queueCount(): number { return readQueue().length; }

// POST that queues on failure. The caller awaits the network attempt;
// on failure we stash and return { ok: false, queued: true }. If the
// network reports success we don't queue.
export async function postWithQueue(endpoint: string, body: any): Promise<{ ok: boolean; queued: boolean; data?: any }> {
  // Optimistic check — if navigator says we're offline, skip the network
  // attempt and queue immediately.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue({ endpoint, body, method: "POST" });
    return { ok: false, queued: true };
  }
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      enqueue({ endpoint, body, method: "POST" });
      return { ok: false, queued: true };
    }
    let data: any;
    try { data = await r.json(); } catch {}
    return { ok: true, queued: false, data };
  } catch {
    enqueue({ endpoint, body, method: "POST" });
    return { ok: false, queued: true };
  }
}

function enqueue(item: Omit<QueuedSave, "id" | "queuedAtIso" | "attempts">): void {
  const q = readQueue();
  q.push({
    id: Math.random().toString(36).slice(2, 10),
    endpoint: item.endpoint,
    method: item.method,
    body: item.body,
    queuedAtIso: new Date().toISOString(),
    attempts: 0,
  });
  writeQueue(q);
}

// Drain the queue. Walks each item, attempts the POST/PUT, removes on
// success. Stops on first failure and leaves the rest for later. Returns
// the number successfully replayed.
export async function drainQueue(): Promise<number> {
  const q = readQueue();
  if (q.length === 0) return 0;
  let drained = 0;
  const remaining: QueuedSave[] = [];
  for (const item of q) {
    try {
      const r = await fetch(item.endpoint, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (r.ok) {
        drained++;
        continue;
      }
      // Server saw it but rejected — keep but bump attempts. After 5
      // attempts, drop to avoid a permanent stuck item.
      const next = { ...item, attempts: item.attempts + 1 };
      if (next.attempts < 5) remaining.push(next);
    } catch {
      // Network died again — stop trying for now, keep remaining items.
      remaining.push(...q.slice(q.indexOf(item)));
      break;
    }
  }
  writeQueue(remaining);
  return drained;
}
