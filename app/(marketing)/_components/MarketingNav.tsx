"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

type ActiveKey = "promo" | "trainer" | "client" | "revenue";

interface NavLinkDef {
  key: ActiveKey;
  href: string;
  label: string;
}

const ALL_LINKS: NavLinkDef[] = [
  { key: "promo", href: "/promo", label: "Overview" },
  { key: "revenue", href: "/revenue", label: "Revenue Model" },
  { key: "trainer", href: "/trainer", label: "For Trainers" },
  { key: "client", href: "/client", label: "For Athletes" },
];

interface MarketingNavProps {
  active: ActiveKey;
  ctaLabel?: string | null;
  ctaHref?: string;
  ctaVariant?: "orange" | "teal";
  showRevenue?: boolean;
}

export function MarketingNav({
  active,
  ctaLabel = "Get Early Access",
  ctaHref = "https://wa.me/9609120007?text=Hi%2C+I%27d+like+to+request+early+access+to+IronLog",
  ctaVariant = "orange",
  showRevenue = false,
}: MarketingNavProps) {
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [10, 20]);
  const bg = useTransform(
    scrollY,
    [0, 120],
    ["rgba(9, 9, 16, 0.7)", "rgba(9, 9, 16, 0.92)"]
  );

  const links = ALL_LINKS.filter((l) => l.key !== "promo" && (showRevenue || l.key !== "revenue"));

  return (
    <motion.nav
      className="mkt-nav"
      style={{
        backdropFilter: blur.get() ? `blur(${blur.get()}px)` : undefined,
        background: bg,
      }}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href="/promo" className="mkt-logo">
        IRON<span>LOG</span>
      </Link>
      <div className="mkt-nav-links">
        <Link
          href="/promo"
          className={`mkt-nav-link${active === "promo" ? " active" : ""}`}
        >
          Overview
        </Link>
        {links.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className={`mkt-nav-link${active === l.key ? " active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
        {ctaLabel ? (
          <a href={ctaHref} className={`mkt-nav-cta${ctaVariant === "teal" ? " teal" : ""}`}>
            {ctaLabel}
          </a>
        ) : null}
      </div>
    </motion.nav>
  );
}
