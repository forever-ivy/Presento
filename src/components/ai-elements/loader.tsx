"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Loader({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-[var(--presento-border)] border-t-[var(--presento-blue)]", className)}
      role="status"
      {...props}
    />
  );
}
