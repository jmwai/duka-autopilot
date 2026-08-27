"use client";

import { LogOut, Search, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { LogoutButton } from "@/components/control-room/logout-button";
import { currentNavigationItem, navigationGroups } from "@/components/control-room/navigation";
import { EnvironmentBadge } from "@/components/control-room/proof-sheet";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ControlRoomTopBar({ environment }: { environment: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = currentNavigationItem(pathname);
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigate(href: string) {
    setCommandOpen(false);
    router.push(href);
  }

  return (
    <>
      <header data-print-hide className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/92 px-3 backdrop-blur sm:px-5 md:px-7">
        <SidebarTrigger aria-label="Toggle primary navigation" />
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="min-w-0 flex-nowrap">
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink asChild><Link href="/">Duka la Amani</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{current.label}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button type="button" variant="outline" className="hidden h-9 min-h-9 w-56 justify-start gap-2 px-3 text-muted-foreground lg:flex" onClick={() => setCommandOpen(true)}>
          <Search aria-hidden="true" />
          <span className="font-normal">Find a screen…</span>
          <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.62rem]">⌘K</kbd>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Open command menu" onClick={() => setCommandOpen(true)}><Search aria-hidden="true" /></Button>

        <span className="hidden sm:inline-flex"><EnvironmentBadge environment={environment} /></span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Open owner menu"><UserRound aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block text-foreground">Duka owner</span>
              <span className="mt-0.5 block font-mono text-[0.62rem] font-normal uppercase tracking-[0.14em]">{environment}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/"><Store aria-hidden="true" /> Morning brief</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutButton className="h-auto min-h-0 w-full justify-start rounded-md px-2.5 py-2 font-normal hover:bg-accent">
                <LogOut aria-hidden="true" /> Sign out
              </LogoutButton>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Go to a Duka workspace…" />
        <CommandList>
          <CommandEmpty>No Duka workspace found.</CommandEmpty>
          {navigationGroups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`${group.label} ${label}`} onSelect={() => navigate(href)}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {href === "/" ? <CommandShortcut>Home</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
