import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Ironlog",
  manifest: "/admin-manifest.json",
  icons: {
    icon: "/admin-favicon.svg",
    apple: "/apple-touch-icon-admin.png",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta name="apple-mobile-web-app-title" content="IL Admin" />
      {children}
    </>
  );
}
