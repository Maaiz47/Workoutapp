import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Ironlog",
  icons: { icon: "/admin-icon.svg" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
