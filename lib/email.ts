function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@ironlog.app";

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IRONLOG</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <!-- Header -->
        <tr><td style="background:#0d0d0d;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <span style="font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#ffffff;">IRON</span><span style="font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#FF6B6B;">LOG</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
          ${content}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
            This email was sent to you because an action was taken on your IRONLOG account.<br>
            If you did not request this, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">IRONLOG &mdash; Track &middot; Lift &middot; Progress</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordEmail(
  to: string,
  username: string,
  tempPassword: string
): Promise<{ sent: boolean }> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[IRONLOG] SMTP not configured — temp password for ${username}: ${tempPassword}`);
    return { sent: false };
  }

  const html = baseHtml(`
    <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 8px;">Hi ${username},</p>
    <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
      We received a request to reset your IRONLOG password. Here is your temporary password:
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
      <span style="font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:4px;color:#111827;">${tempPassword}</span>
    </div>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 8px;">
      Log in with this password and you will be prompted to set a new one straight away.
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:0;">This temporary password expires once you set a new one.</p>
  `);

  const text = `Hi ${username},\n\nYour IRONLOG temporary password is: ${tempPassword}\n\nLog in and you will be asked to set a new password immediately.\n\nIf you did not request this, you can safely ignore this email.\n\n— IRONLOG`;

  try {
    await transporter.sendMail({
      from: FROM(),
      to,
      subject: "Your IRONLOG temporary password",
      html,
      text,
    });
    return { sent: true };
  } catch (e) {
    console.error("[IRONLOG] Email send failed:", e);
    return { sent: false };
  }
}

export async function sendWelcomeEmail(
  to: string,
  username: string
): Promise<{ sent: boolean }> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[IRONLOG] SMTP not configured — skipping welcome email for ${username}`);
    return { sent: false };
  }

  const html = baseHtml(`
    <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 8px;">Welcome to IRONLOG, ${username}.</p>
    <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
      Your account is set up and ready to go. Start tracking your lifts, monitor your progress, and hit new personal bests.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;border-left:3px solid #FF6B6B;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">Log every set</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Track weight and reps for each set with built-in rest timers.</p>
        </td>
      </tr>
      <tr><td style="padding:6px 0;"></td></tr>
      <tr>
        <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;border-left:3px solid #FF6B6B;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">See your progress</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Session history, personal records, and trends are tracked automatically.</p>
        </td>
      </tr>
      <tr><td style="padding:6px 0;"></td></tr>
      <tr>
        <td style="background:#f9fafb;border-radius:8px;padding:16px 20px;border-left:3px solid #FF6B6B;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">Beat last session</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Every set shows how it compares to your last session for that day.</p>
        </td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:13px;margin:0;">Good luck with your training.</p>
  `);

  const text = `Welcome to IRONLOG, ${username}.\n\nYour account is ready. Log your sets, track your progress, and beat your last session every time.\n\nGood luck with your training.\n\n— IRONLOG`;

  try {
    await transporter.sendMail({
      from: FROM(),
      to,
      subject: "Welcome to IRONLOG",
      html,
      text,
    });
    return { sent: true };
  } catch (e) {
    console.error("[IRONLOG] Welcome email send failed:", e);
    return { sent: false };
  }
}
