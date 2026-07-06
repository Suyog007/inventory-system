"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Layers3,
  RefreshCw,
  Users,
  Store,
  Tags,
  DollarSign,
  Sparkles,
  Settings,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cards", label: "Cards", icon: Layers3 },
  { href: "/sync", label: "Sync", icon: RefreshCw },
];

const SETTINGS_NAV: NavItem[] = [
  { href: "/settings/channels", label: "Channels", icon: Store },
  { href: "/settings/categories", label: "Categories", icon: Tags },
  { href: "/settings/pricing", label: "Pricing", icon: DollarSign },
  { href: "/settings/users", label: "Users", icon: Users },
];

interface Props {
  user: { email: string; name?: string | null; role: string };
  isAdmin: boolean;
  signOutSlot: React.ReactNode;
}

export default function Sidebar({ user, isAdmin, signOutSlot }: Props) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const inSettings = pathname.startsWith("/settings");

  return (
    <nav className="w-60 shrink-0 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 flex flex-col border-r border-slate-800">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800/60">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">
              inventory-ags
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              Card Ops
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <NavGroup items={MAIN_NAV} isActive={isActive} />
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Admin
            </div>
            <SettingsMenu
              items={SETTINGS_NAV}
              isActive={isActive}
              defaultOpen={inSettings}
              parentActive={inSettings}
            />
          </div>
        )}
      </div>

      {/* User + sign out */}
      <div className="border-t border-slate-800/60 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {(user.name || user.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-200 truncate">
              {user.name || user.email.split("@")[0]}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              {user.role}
            </div>
          </div>
        </div>
        <div className="mt-1">{signOutSlot}</div>
      </div>
    </nav>
  );
}

function NavGroup({
  heading,
  items,
  isActive,
}: {
  heading?: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <div>
      {heading && (
        <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          {heading}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  active
                    ? "bg-blue-500/10 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }
              `}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-blue-400" />
              )}
              <Icon
                className={`w-4 h-4 ${active ? "text-blue-300" : "text-slate-400"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Collapsible "Settings" section — clicking the parent toggles the sub-items.
// When we're on any /settings/* route the group opens by default so the user
// can see where they are without having to reopen it every navigation.
function SettingsMenu({
  items,
  isActive,
  defaultOpen,
  parentActive,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  defaultOpen: boolean;
  parentActive: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
          ${
            parentActive
              ? "bg-blue-500/10 text-white shadow-sm"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          }
        `}
        aria-expanded={open}
      >
        {parentActive && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-blue-400" />
        )}
        <Settings
          className={`w-4 h-4 ${parentActive ? "text-blue-300" : "text-slate-400"}`}
        />
        <span className="flex-1 text-left">Settings</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""} ${parentActive ? "text-blue-300" : "text-slate-500"}`}
        />
      </button>
      {open && (
        <div className="relative pl-6 py-1 space-y-0.5">
          <span className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${
                    active
                      ? "bg-blue-500/10 text-white"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                  }
                `}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${active ? "text-blue-300" : "text-slate-500"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
