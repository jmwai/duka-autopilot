"use client";

import {
  Archive,
  Boxes,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  MessageCircleMore,
  MoonStar,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Morning brief", shortLabel: "Brief", icon: LayoutDashboard },
  { href: "/approvals", label: "Decisions", shortLabel: "Decisions", icon: ClipboardCheck },
  { href: "/inbox", label: "Customer inbox", shortLabel: "Inbox", icon: MessageCircleMore },
  { href: "/night-shift", label: "Night shift", shortLabel: "Night", icon: MoonStar },
  { href: "/ledger", label: "Ledger desk", shortLabel: "Ledger", icon: ReceiptText },
  { href: "/orders", label: "Orders", shortLabel: "Orders", icon: Archive },
  { href: "/inventory", label: "Stock", shortLabel: "Stock", icon: Boxes },
  { href: "/evidence", label: "How Duka worked", shortLabel: "Evidence", icon: FileSearch },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="space-y-1 px-3">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              active && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4.5" strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const visible = navigation.slice(0, 4);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
    >
      {visible.map(({ href, shortLabel, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.68rem] font-semibold text-muted-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4.5" />
            <span>{shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
