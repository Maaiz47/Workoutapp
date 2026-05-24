import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// Parse a YYYY-MM-DD client-local date string into a UTC-midnight
// Date. WellnessLog.date is @db.Date so the time-of-day is dropped
// at the DB layer anyway; we use UTC midnight for stable equality.
function parseLocalDate(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(+d)) return null;
  return d;
}

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : (typeof v === "string" ? parseFloat(v) : NaN);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < lo || i > hi) return null;
  return i;
}

function clampFloat(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : (typeof v === "string" ? parseFloat(v) : NaN);
  if (!Number.isFinite(n)) return null;
  if (n < lo || n > hi) return null;
  return Math.round(n * 100) / 100;
}

// GET — return the last 30 days of wellness logs for the current user,
// most-recent first. Client uses this to seed/reconcile localStorage
// state on app load. (qa: wellness-sync-v1)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const logs = await prisma.wellnessLog.findMany({
      where: { userId: uid, date: { gte: cutoff } },
      orderBy: { date: "desc" },
    });
    return json({
      logs: logs.map(l => ({
        date: l.date.toISOString().slice(0, 10),
        glasses: l.glasses,
        sleepHours: l.sleepHours,
        energy: l.energy,
      })),
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — upsert one day's wellness, OR a batch of days. Single shape:
//   { date: "YYYY-MM-DD", glasses?, sleepHours?, energy? }
// Batch shape (used for initial localStorage → server migration):
//   { entries: [{ date, glasses?, sleepHours?, energy? }, ...] }
//
// Any subset of {glasses, sleepHours, energy} can be provided per
// entry. Existing fields on the row are preserved when omitted (we
// merge, not replace). null values clear a field. (qa: wellness-sync-v1)
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const raw: any[] = Array.isArray(body?.entries) ? body.entries : [body];
    if (raw.length === 0) return json({ error: "No entries provided" }, 400);
    if (raw.length > 60) return json({ error: "Too many entries (max 60)" }, 400);

    let written = 0;
    for (const e of raw) {
      const date = parseLocalDate(e?.date);
      if (!date) continue;
      // Clamp to sensible ranges so junk client data can't poison
      // the DB. Glasses 0-50, sleep 0-24h, energy 1-5.
      const glasses = "glasses" in e ? (e.glasses === null ? null : clampInt(e.glasses, 0, 50)) : undefined;
      const sleepHours = "sleepHours" in e ? (e.sleepHours === null ? null : clampFloat(e.sleepHours, 0, 24)) : undefined;
      const energy = "energy" in e ? (e.energy === null ? null : clampInt(e.energy, 1, 5)) : undefined;

      // If no field is being updated, skip silently — saves a write.
      if (glasses === undefined && sleepHours === undefined && energy === undefined) continue;

      const createData: any = { userId: uid, date };
      if (glasses !== undefined) createData.glasses = glasses;
      if (sleepHours !== undefined) createData.sleepHours = sleepHours;
      if (energy !== undefined) createData.energy = energy;
      const updateData: any = {};
      if (glasses !== undefined) updateData.glasses = glasses;
      if (sleepHours !== undefined) updateData.sleepHours = sleepHours;
      if (energy !== undefined) updateData.energy = energy;

      await prisma.wellnessLog.upsert({
        where: { userId_date: { userId: uid, date } },
        create: createData,
        update: updateData,
      });
      written++;
    }

    return json({ written });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
