import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, generateTempPassword } from "../../../../lib/crypto";
import { sendPasswordEmail } from "../../../../lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@"))
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json({ success: true });

    const temp = generateTempPassword();
    const hash = await hashPassword(temp);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, mustResetPassword: true },
    });

    const { sent } = await sendPasswordEmail(user.email!, user.username, temp);

    if (!sent) {
      return NextResponse.json(
        { error: "Email could not be sent — contact support" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
