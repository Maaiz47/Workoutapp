import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Ironlog",
  manifest: "/admin-manifest.json",
  icons: {
    icon: "/admin-favicon.svg",
    apple: "/admin-icon.svg",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
