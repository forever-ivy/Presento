import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "border-input bg-background flex min-h-9 w-full min-w-0 flex-col rounded-2xl border shadow-xs transition-[color,box-shadow] outline-none",
        "focus-within:border-ring focus-within:ring-ring/35 focus-within:ring-[2px]",
        "has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  align = "inline-start",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "block-start" | "block-end" | "inline-start" | "inline-end";
}) {
  return (
    <div
      data-align={align}
      data-slot="input-group-addon"
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        align === "block-start" && "order-first w-full",
        align === "block-end" && "order-last w-full",
        align === "inline-start" && "order-first",
        align === "inline-end" && "order-last",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="input-group-button"
      className={cn("rounded-xl", className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea };
