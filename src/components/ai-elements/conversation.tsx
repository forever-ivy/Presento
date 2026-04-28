"use client";

import { ArrowDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Conversation({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden", className)} role="log" {...props}>
      {children}
    </div>
  );
}

export function ConversationContent({ className, children, ...props }: ComponentProps<"div">) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [children]);

  function updateScrollState() {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScroll(distanceFromBottom > 48);
  }

  return (
    <>
      <div
        className={cn("flex h-full flex-col gap-3 overflow-y-auto p-1 pr-2", className)}
        onScroll={updateScrollState}
        ref={scrollRef}
        {...props}
      >
        {children}
      </div>
      {showScroll ? (
        <ConversationScrollButton
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
        />
      ) : null}
    </>
  );
}

export function ConversationEmptyState({
  className,
  description,
  icon,
  title = "暂无对话",
  children,
  ...props
}: ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-3 p-6 text-center", className)} {...props}>
      {children ?? (
        <>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
          <div>
            <div className="text-sm font-black text-[var(--presento-ink)]">{title}</div>
            {description ? <div className="mt-1 text-xs font-semibold text-[var(--presento-muted)]">{description}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function ConversationScrollButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("absolute bottom-3 left-1/2 size-8 -translate-x-1/2 rounded-full", className)}
      size="icon-sm"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDown aria-hidden="true" />
      <span className="sr-only">滚动到底部</span>
    </Button>
  );
}
