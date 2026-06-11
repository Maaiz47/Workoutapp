import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "../../../lib/prisma";
import { safeFloat } from "../../../lib/num";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — list the user's progress photos, newest first.
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const photos = await (prisma as any).progressPhoto.findMany({
      where: { userId: uid },
      orderBy: { takenAt: "desc" },
      select: { id: true, url: true, takenAt: true, weightKg: true, notes: true },
    });
    return json({ photos });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — upload a new photo via multipart/form-data. Body fields:
//   file: the image blob
//   weightKg: optional, snapshot of bodyweight at the time
//   notes: optional caption
// Requires BLOB_READ_WRITE_TOKEN env var to be set on Vercel. Without it
// the @vercel/blob.put() call throws a clear error.
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return json({ error: "Missing file" }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ error: "Photo too large (8MB max)" }, 400);

    const weightStr = form.get("weightKg");
    const notesStr = form.get("notes");
    // NaN-guard: a junk weight snapshot becomes null, not NaN. (qa: numeric-nan-guards)
    const weightKg = safeFloat(weightStr);
    const notes = notesStr ? String(notesStr).slice(0, 240) : null;

    // Per-user pathing keeps blobs separated. Random suffix so URL is
    // unguessable; @vercel/blob defaults to public access (read-only by
    // anyone with the URL) which is fine for this MVP — URLs only land
    // in the DB row keyed by the owning user.
    const ext = (file.name?.split(".").pop() ?? "jpg").toLowerCase().slice(0, 4);
    const path = `progress/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploaded = await put(path, file, { access: "public", addRandomSuffix: false });

    const row = await (prisma as any).progressPhoto.create({
      data: { userId: uid, url: uploaded.url, weightKg, notes },
      select: { id: true, url: true, takenAt: true, weightKg: true, notes: true },
    });
    return json({ photo: row }, 201);
  } catch (e: any) {
    const msg = e?.message ?? "Upload failed";
    // Surface a useful error if the token is missing — easier debugging.
    if (/token|blob/i.test(msg)) {
      return json({ error: "Photo storage isn't configured. Add BLOB_READ_WRITE_TOKEN to Vercel env vars and redeploy." }, 500);
    }
    return json({ error: msg }, 500);
  }
}
