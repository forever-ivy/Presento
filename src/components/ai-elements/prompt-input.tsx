"use client";

import { CornerDownLeftIcon, Loader2Icon, SquareIcon, XIcon } from "lucide-react";
import { useState, type ComponentProps, type FormEvent, type KeyboardEventHandler } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputMessage = {
  text: string;
  files?: File[];
};

export function PromptInput({
  className,
  children,
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
      className={cn("w-full", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <InputGroup className="relative overflow-hidden rounded-2xl">{children}</InputGroup>
    </form>
  );
}

export function PromptInputBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("contents", className)} {...props} />;
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  ...props
}: ComponentProps<typeof InputGroupTextarea>) {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing) return;
    event.preventDefault();

    const submitButton = event.currentTarget.form?.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    if (submitButton?.disabled) return;

    event.currentTarget.form?.requestSubmit();
  };

  return (
    <InputGroupTextarea
      className={cn(
        "field-sizing-content max-h-40 min-h-24 px-4 py-3 pr-16 pb-12 text-base leading-6 md:text-sm",
        className,
      )}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder="围绕当前资料继续追问"
      {...props}
    />
  );
}

export function PromptInputFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 justify-between gap-2 border-0 bg-transparent px-3 py-3", className)}
      {...props}
    />
  );
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("pointer-events-auto flex min-w-0 flex-1 items-center gap-2", className)} {...props} />;
}

export function PromptInputSubmit({
  className,
  status,
  ...props
}: ComponentProps<typeof InputGroupButton> & {
  status?: "ready" | "submitted" | "streaming" | "error";
}) {
  const busy = status === "submitted" || status === "streaming";
  let icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    icon = <XIcon className="size-4" />;
  }

  return (
    <InputGroupButton
      aria-label={busy ? "停止生成" : "发送"}
      className={cn("pointer-events-auto rounded-xl", className)}
      disabled={busy || props.disabled}
      size="icon"
      type="submit"
      variant="default"
      {...props}
    >
      {props.children ?? icon}
    </InputGroupButton>
  );
}
