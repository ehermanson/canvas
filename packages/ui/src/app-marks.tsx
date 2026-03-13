import { Home } from "lucide-react";
import * as React from "react";

export function HangTimeAppIcon({ className }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect
        x="3.75"
        y="6.25"
        width="12.5"
        height="10"
        rx="1.15"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <rect
        x="6"
        y="8.5"
        width="8"
        height="5.5"
        rx="0.65"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
        fill="none"
      />
      <path
        d="M6.5 6L10 2.75L13.5 6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="10" cy="2.75" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function FloorPlanAppIcon({
  className,
}: React.ComponentProps<typeof Home>) {
  return <Home className={className} />;
}
