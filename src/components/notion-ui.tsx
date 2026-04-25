import type { LucideIcon } from "lucide-react";
import { ArrowLeft, GraduationCap, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppFrame({ children }: { children: ReactNode }) {
  return <main className="notion-shell">{children}</main>;
}

export function PageWrap({
  children,
  width = "max-w-[1200px]",
}: {
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-8 px-4 py-6 md:px-8", width)}>
      {children}
    </div>
  );
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-[34px] items-center justify-center rounded-[8px] border border-[var(--notion-border)] bg-white shadow-[var(--notion-card-shadow)]">
        <GraduationCap aria-hidden="true" />
      </div>
      <div>
        <div className="text-[15px] font-bold leading-tight tracking-[-0.25px]">
          答辩台
        </div>
        <div className="notion-muted text-xs">AI Defense Coach</div>
      </div>
    </div>
  );
}

export function TopNav() {
  return (
    <header className="border-b border-[var(--notion-border)] bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-8">
        <BrandMark />
        <nav className="hidden items-center gap-6 text-[15px] font-semibold text-[rgba(0,0,0,0.95)] md:flex">
          <Link className="hover:text-[var(--notion-blue)]" href="/">
            准备台
          </Link>
          <Link className="hover:text-[var(--notion-blue)]" href="/projects/demo/defense">
            同屏答辩
          </Link>
          <Link className="hover:text-[var(--notion-blue)]" href="/projects/demo/deep-dive">
            项目钻研
          </Link>
          <Link className="hover:text-[var(--notion-blue)]" href="/projects/demo/skills">
            Skills
          </Link>
          <Link className="hover:text-[var(--notion-blue)]" href="/projects/demo/files">
            资料库
          </Link>
        </nav>
        <Link className="notion-button-primary" href="/projects/new">
          <Plus aria-hidden="true" />
          新建训练
        </Link>
      </div>
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="notion-muted mb-3 text-sm font-medium">{eyebrow}</div>
        ) : null}
        <h1 className="notion-title text-[2rem] md:text-[3rem]">{title}</h1>
        {description ? (
          <p className="notion-muted mt-4 max-w-2xl text-base leading-7 md:text-xl md:font-semibold">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("notion-card p-5", className)}>{children}</section>;
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("notion-panel p-5", className)}>{children}</section>;
}

export function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="text-[var(--notion-blue)]" aria-hidden="true" /> : null}
          <h2 className="notion-card-title">{title}</h2>
        </div>
        {description ? (
          <p className="notion-muted mt-2 text-sm leading-6">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gray" | "orange" | "green" }) {
  const toneClass = {
    blue: "notion-badge",
    gray: "rounded-full bg-[rgba(0,0,0,0.05)] px-2 py-1 text-xs font-semibold text-[var(--notion-muted)]",
    orange: "rounded-full bg-[#fff4eb] px-2 py-1 text-xs font-semibold text-[#dd5b00]",
    green: "rounded-full bg-[#eefaf0] px-2 py-1 text-xs font-semibold text-[#1aae39]",
  }[tone];

  return <span className={toneClass}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[rgba(0,0,0,0.08)]">
      <div
        className="h-full rounded-full bg-[var(--notion-blue)] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function BackLink({ href = "/", label = "返回准备台" }: { href?: string; label?: string }) {
  return (
    <Link className="notion-button-secondary" href={href}>
      <ArrowLeft aria-hidden="true" />
      {label}
    </Link>
  );
}
