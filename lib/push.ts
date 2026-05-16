import webPush from "web-push";
import { prisma } from "./prisma";

const VAPID_PUBLIC_KEY = "BOhlYEJGvtpt4q1HA9DkjMDIvNpj-Yh9ia8Jffoy1ETlCMDxzqUDJzXMRSE1ByqbHooHvqHRmTW47G_osz8P5p4";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:admin@ironlogmv.vercel.app";

if (VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!VAPID_PRIVATE_KEY) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(sub =>
      webPush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(() => {}) // ignore expired / invalid subscriptions
    )
  );
}
