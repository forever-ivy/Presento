"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within DropdownMenu.");
  }

  return context;
}

function DropdownMenu({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <DropdownMenuContext.Provider value={value}>
      <div className="relative inline-flex" data-slot="dropdown-menu" ref={rootRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownChildProps = {
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  "aria-expanded"?: boolean;
  "data-slot"?: string;
};

function DropdownMenuTrigger({
  asChild = false,
  children,
  className,
}: {
  asChild?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useDropdownMenu();

  function handleClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    setOpen(!open);
  }

  if (asChild && isValidElement<DropdownChildProps>(children)) {
    const child = children as ReactElement<DropdownChildProps>;

    return cloneElement(child, {
      "aria-expanded": open,
      className: cn(child.props.className, className),
      "data-slot": "dropdown-menu-trigger",
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) handleClick(event);
      },
    });
  }

  return (
    <button
      aria-expanded={open}
      className={className}
      data-slot="dropdown-menu-trigger"
      onClick={() => setOpen(!open)}
      type="button"
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({
  align = "center",
  className,
  children,
}: ComponentProps<"div"> & {
  align?: "start" | "center" | "end";
}) {
  const { open } = useDropdownMenu();

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute top-[calc(100%+0.5rem)] z-60",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        className,
      )}
      data-slot="dropdown-menu-content"
    >
      {children}
    </div>
  );
}

function DropdownMenuGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={className} data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<"div">) {
  return <div className={className} data-slot="dropdown-menu-label" {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<"div">) {
  return <div className={className} data-slot="dropdown-menu-separator" {...props} />;
}

function DropdownMenuItem({
  asChild = false,
  className,
  children,
}: ComponentProps<"button"> & {
  asChild?: boolean;
}) {
  const { setOpen } = useDropdownMenu();

  if (asChild && isValidElement<DropdownChildProps>(children)) {
    const child = children as ReactElement<DropdownChildProps>;

    return cloneElement(child, {
      className: cn(child.props.className, className),
      "data-slot": "dropdown-menu-item",
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      },
    });
  }

  return (
    <button
      className={className}
      data-slot="dropdown-menu-item"
      onClick={() => setOpen(false)}
      type="button"
    >
      {children}
    </button>
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
