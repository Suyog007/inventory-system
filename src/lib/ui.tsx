// Small, reusable UI primitives. Not a full design system — just enough shape
// to keep buttons, badges, page headers, and empty states visually consistent
// across the app without dragging in shadcn/ui.

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800",
  secondary:
    "bg-white text-gray-800 border border-gray-300 shadow-sm hover:bg-gray-50 active:bg-gray-100",
  ghost:
    "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;
}

// ─────────────────────────────────────────────────────────────
// Badge — for status pills, tags, chips
// ─────────────────────────────────────────────────────────────

type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "indigo";

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-gray-100 text-gray-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export function Badge({
  children,
  variant = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${BADGE_VARIANTS[variant]}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// PageHeader — the top of every dashboard page
// ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-2">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyState — for "no cards yet", "no runs yet", etc.
// ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className={`${buttonClass("primary", "md")} mt-4`}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SectionCard — the standard white card container
// ─────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  action,
  children,
  className = "",
  padding = "p-6",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${padding} ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Channel branding — colored dot + label
// ─────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  SHOPIFY: { bg: "bg-emerald-100", text: "text-emerald-700" },
  EBAY: { bg: "bg-blue-100", text: "text-blue-700" },
  TIKTOK: { bg: "bg-pink-100", text: "text-pink-700" },
  WHATNOT: { bg: "bg-yellow-100", text: "text-yellow-800" },
  SQUARE: { bg: "bg-slate-100", text: "text-slate-700" },
  WALMART: { bg: "bg-sky-100", text: "text-sky-700" },
  LOUPE: { bg: "bg-violet-100", text: "text-violet-700" },
  MYCARDPOST: { bg: "bg-orange-100", text: "text-orange-700" },
  MASCOTNETWORK: { bg: "bg-teal-100", text: "text-teal-700" },
  MERCURY: { bg: "bg-indigo-100", text: "text-indigo-700" },
};

export function ChannelPill({ channel }: { channel: string }) {
  const c = CHANNEL_COLORS[channel] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.text.replace("text-", "bg-")}`} />
      {channel}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Alert boxes
// ─────────────────────────────────────────────────────────────

type AlertVariant = "success" | "error" | "warning" | "info";

const ALERT_STYLES: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    icon: "text-emerald-600",
  },
  error: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    icon: "text-rose-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: "text-amber-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "text-blue-600",
  },
};

export function Alert({
  variant = "info",
  icon: Icon,
  children,
}: {
  variant?: AlertVariant;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const s = ALERT_STYLES[variant];
  return (
    <div className={`flex items-start gap-2 ${s.bg} ${s.border} border ${s.text} rounded-lg p-3 text-sm`}>
      {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.icon}`} />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconType = ComponentType<any>;
