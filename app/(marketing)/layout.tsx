import "./marketing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IRONLOG — Built for serious trainers and athletes",
  description:
    "IronLog is the all-in-one training platform — manage clients, write programs, log every set, track every PR.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="mkt-root">{children}</div>;
}
