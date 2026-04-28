"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Message({
  className,
  from,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  from: "system" | "user" | "assistant" | "data";
}) {
  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-2",
        from === "user" ? "items-end" : "items-start",
        className,
      )}
      data-role={from}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "max-w-[92%] rounded-2xl px-3 py-2 text-sm font-semibold leading-6",
        "group-data-[role=user]:bg-[var(--presento-navy)] group-data-[role=user]:text-white",
        "group-data-[role=assistant]:border group-data-[role=assistant]:border-[var(--presento-border)] group-data-[role=assistant]:bg-white",
        className,
      )}
      {...props}
    />
  );
}

export function MessageResponse({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)} {...props}>
      {children}
    </div>
  );
}

export const Response = MessageResponse;
