"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Sources({ className, ...props }: ComponentProps<"details">) {
  return <details className={cn("group rounded-xl border border-[var(--presento-border)] bg-[var(--presento-soft)] p-3", className)} {...props} />;
}

export function SourcesTrigger({
  className,
  count,
  children,
  ...props
}: ComponentProps<"summary"> & {
  count: number;
}) {
  return (
    <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-[var(--presento-muted)]", className)} {...props}>
      {children ?? <span>引用来源 {count}</span>}
      <ChevronDown aria-hidden="true" className="transition group-open:rotate-180" />
    </summary>
  );
}

export function SourcesContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-3 flex flex-col gap-2", className)} {...props} />;
}

export function Source({ className, href = "#", title, children, ...props }: ComponentProps<"a">) {
  return (
    <a className={cn("flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-[var(--presento-muted)]", className)} href={href} {...props}>
      {children ?? (
        <>
          <BookOpen aria-hidden="true" />
          <span>{title}</span>
        </>
      )}
    </a>
  );
}
