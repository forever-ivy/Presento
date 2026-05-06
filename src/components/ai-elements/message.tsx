"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
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
        "max-w-[92%] text-sm font-semibold leading-6",
        "group-data-[role=user]:rounded-3xl group-data-[role=user]:bg-neutral-100 group-data-[role=user]:px-4 group-data-[role=user]:py-2.5 group-data-[role=user]:text-[var(--presento-ink)]",
        "group-data-[role=assistant]:w-full group-data-[role=assistant]:max-w-none group-data-[role=assistant]:px-0 group-data-[role=assistant]:py-1 group-data-[role=assistant]:text-[var(--presento-ink)]",
        className,
      )}
      {...props}
    />
  );
}

export function MessageResponse({ className, children, ...props }: ComponentProps<"div">) {
  const markdown = typeof children === "string" ? children : null;
  return (
    <div
      className={cn(
        "break-words",
        "prose prose-sm max-w-none prose-p:my-1 prose-ol:my-1 prose-ul:my-1 prose-li:my-0 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-bold prose-code:text-[var(--presento-ink)] prose-strong:font-black",
        className,
      )}
      {...props}
    >
      {markdown ? (
        <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
          {markdown}
        </ReactMarkdown>
      ) : children}
    </div>
  );
}

export const Response = MessageResponse;
