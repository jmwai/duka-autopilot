"use client";

import {
  Archive,
  Boxes,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  Menu,
  MessageCircleMore,
  MoonStar,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

export const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/", label: "Morning brief", shortLabel: "Brief", icon: LayoutDashboard },
      { href: "/approvals", label: "Decisions", shortLabel: "Decisions", icon: ClipboardCheck },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/inbox", label: "Customer inbox", shortLabel: "Inbox", icon: MessageCircleMore },
      { href: "/ledger", label: "Ledger desk", shortLabel: "Ledger", icon: ReceiptText },
      { href: "/orders", label: "Orders", shortLabel: "Orders", icon: Archive },
      { href: "/inventory", label: "Stock", shortLabel: "Stock", icon: Boxes },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/night-shift", label: "Night shift", shortLabel: "Night", icon: MoonStar },
    ],
  },
  {
    label: "Proof",
    items: [
      { href: "/evidence", label: "How Duka worked", shortLabel: "Evidence", icon: FileSearch },
    ],
  },
] as const;

export const navigationItems: NavigationItem[] = navigationGroups.flatMap((group) => [...group.items]);

export function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function currentNavigationItem(pathname: string) {
  return navigationItems.find((item) => isActiveRoute(pathname, item.href)) ?? navigationItems[0];
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <nav aria-label="Primary navigation">
      {navigationGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActiveRoute(pathname, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => { if (isMobile) setOpenMobile(false); }}
                      >
                        <Icon aria-hidden="true" strokeWidth={active ? 2.2 : 1.8} />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = navigationItems.slice(0, 3);
  const moreActive = !visible.some((item) => isActiveRoute(pathname, item.href));

  return (
    <nav
      data-print-hide
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
    >
      {visible.map(({ href, shortLabel, icon: Icon }) => {
        const active = isActiveRoute(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.68rem] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4.5" />
            <span>{shortLabel}</span>
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Open all navigation"
        aria-current={moreActive ? "page" : undefined}
        onClick={() => setOpenMobile(true)}
        className={cn(
          "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.68rem] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          moreActive && "bg-accent text-accent-foreground",
        )}
      >
        <Menu aria-hidden="true" className="size-4.5" />
        <span>More</span>
      </button>
    </nav>
  );
}
