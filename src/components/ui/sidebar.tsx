"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type SidebarState = "expanded" | "collapsed";

type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  open = true,
  children,
}: {
  open?: boolean;
  children: ReactNode;
}) {
  const state: SidebarState = open ? "expanded" : "collapsed";
  const value = useMemo<SidebarContextValue>(() => ({ state, open }), [open, state]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function Sidebar({
  className,
  collapsible = "icon",
  children,
  ...props
}: ComponentProps<"aside"> & {
  collapsible?: "icon" | "none";
}) {
  const { state } = useSidebar();

  return (
    <aside
      className={className}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-state={state}
      {...props}
    >
      {children}
    </aside>
  );
}

function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-auto", className)}
      data-sidebar="content"
      data-slot="sidebar-content"
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex min-w-0 flex-col", className)}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}

function SidebarGroupLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={className}
      data-sidebar="group-label"
      data-slot="sidebar-group-label"
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex min-w-0 flex-col gap-1", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("relative", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}

type SidebarMenuChildProps = {
  className?: string;
  title?: string;
  "data-active"?: string;
  "data-sidebar"?: string;
  "data-slot"?: string;
};

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  tooltip,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}) {
  const { state } = useSidebar();
  const title = state === "collapsed" ? tooltip : undefined;

  if (asChild && isValidElement<SidebarMenuChildProps>(children)) {
    const child = children as ReactElement<SidebarMenuChildProps>;

    return cloneElement(child, {
      className: cn(child.props.className, className),
      "data-active": isActive ? "true" : undefined,
      "data-sidebar": "menu-button",
      "data-slot": "sidebar-menu-button",
      title: title ?? child.props.title,
    });
  }

  return (
    <button
      className={className}
      data-active={isActive ? "true" : undefined}
      data-sidebar="menu-button"
      data-slot="sidebar-menu-button"
      title={title}
      {...props}
    >
      {children}
    </button>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
};
