import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser } from "../../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    await sendPushToUser(uid, {
      title: "IRONLOG",
      body: "Push notifications are working!",
      url: "/",
    });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
