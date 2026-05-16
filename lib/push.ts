import { prisma } from "./prisma";

export const VAPID_PUBLIC_KEY = "BOhlYEJGvtpt4q1HA9DkjMDIvNpj-Yh9ia8Jffoy1ETlCMDxzqUDJzXMRSE1ByqbHooHvqHRmTW47G_osz8P5p4";

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return;

  // Dynamic import keeps web-push out of the module graph at build time
  const webPush = (await import("web-push")).default;
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:admin@ironlogmv.vercel.app",
    VAPID_PUBLIC_KEY,
    privateKey
  );

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(sub =>
      webPush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(() => {})
    )
  );
}
