export async function sendPasswordEmail(
  to: string,
  username: string,
  tempPassword: string
): Promise<{ sent: boolean }> {
  if (!process.env.SMTP_HOST) {
    console.warn(`[IRONLOG] SMTP not configured — temp password for ${username}: ${tempPassword}`);
    return { sent: false };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@ironlog.app",
      to,
      subject: "IRONLOG — Your temporary password",
      html: `
        <div style="font-family:monospace;max-width:420px;margin:0 auto;padding:40px 32px;background:#0a0a0a;color:#fff;border-radius:16px;">
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin-bottom:32px;">
            IRON<span style="color:#FF6B6B;">LOG</span>
          </div>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:8px;">Hi <strong>${username}</strong>,</p>
          <p style="color:rgba(255,255,255,0.5);margin-bottom:24px;">Your temporary password is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;text-align:center;margin-bottom:24px;">
            ${tempPassword}
          </div>
          <p style="color:rgba(255,255,255,0.5);">Log in and you'll be asked to set a new password immediately.</p>
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:32px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (e) {
    console.error("[IRONLOG] Email send failed:", e);
    return { sent: false };
  }
}
