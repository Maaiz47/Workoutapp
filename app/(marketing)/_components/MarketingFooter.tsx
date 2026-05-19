"use client";

interface MarketingFooterProps {
  tagline?: string;
}

export function MarketingFooter({
  tagline = "BUILT FOR ATHLETES · DESIGNED FOR TRAINERS · MADE WITH INTENTION",
}: MarketingFooterProps) {
  return (
    <footer className="mkt-footer">
      <div className="footer-logo">
        IRON<span>LOG</span>
      </div>
      {tagline}
    </footer>
  );
}
