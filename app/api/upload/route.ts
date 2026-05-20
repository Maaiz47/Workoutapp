import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
    if (!user) return json({ error: "Unauthorized" }, 401);

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud || !apiKey || !apiSecret) {
      return json({ error: "Cloudinary not configured" }, 503);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return json({ error: "No file provided" }, 400);
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("upload_preset", "ironlog_unsigned");

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      { method: "POST", body: uploadForm }
    );

    if (!cloudRes.ok) {
      const err = await cloudRes.text();
      return json({ error: `Cloudinary upload failed: ${err}` }, 502);
    }

    const data = await cloudRes.json();
    return json({ url: data.secure_url as string });
  } catch (e: any) {
    return json({ error: e?.message ?? "Upload failed" }, 500);
  }
}
