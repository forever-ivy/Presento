"use client";

import type { ComponentProps, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PromptInputMessage = {
  text: string;
  files?: File[];
};

export function PromptInput({
  className,
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    await onSubmit({ text: String(formData.get("message") ?? "") }, event);
    form.reset();
  }

  return (
    <form
      className={cn("relative rounded-2xl border border-[var(--presento-border)] bg-white p-2 shadow-[var(--presento-card-shadow)]", className)}
      onSubmit={handleSubmit}
      {...props}
    />
  );
}

export function PromptInputBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("contents", className)} {...props} />;
}

export function PromptInputTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn("min-h-20 resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0", className)}
      name="message"
      placeholder="围绕当前资料继续追问"
      {...props}
    />
  );
}

export function PromptInputFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-2 flex items-center justify-between gap-2", className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-center gap-2", className)} {...props} />;
}

export function PromptInputSubmit({
  className,
  status,
  ...props
}: ComponentProps<typeof Button> & {
  status?: "ready" | "submitted" | "streaming" | "error";
}) {
  const busy = status === "submitted" || status === "streaming";
  return (
    <Button className={cn("rounded-xl font-black", className)} disabled={busy || props.disabled} size="sm" type="submit" {...props}>
      {busy ? "发送中" : "发送"}
    </Button>
  );
}
