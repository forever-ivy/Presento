"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ShineBorderProps = {
  borderWidth?: number;
  className?: string;
  duration?: number;
  shineColor?: string | string[];
};

export function ShineBorder({
  borderWidth = 1.5,
  className,
  duration = 9,
  shineColor = ["#10b981", "#38bdf8", "#f59e0b"],
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor : [shineColor];
  const gradient = `conic-gradient(from 0deg, transparent 0deg, ${colors.join(", ")}, transparent 280deg)`;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={{
        "--shine-border-width": `${borderWidth}px`,
        "--shine-duration": `${duration}s`,
        "--shine-gradient": gradient,
      } as CSSProperties}
    >
      <div className="presento-shine-border" />
    </div>
  );
}
