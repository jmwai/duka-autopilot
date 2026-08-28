import { LogOut, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { DesktopNavigation, MobileNavigation } from "@/components/control-room/navigation";
import { LogoutButton } from "@/components/control-room/logout-button";
import { ControlRoomTopBar } from "@/components/control-room/top-bar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";

export async function ControlRoomShell({ children }: { children: React.ReactNode }) {
  const environment = process.env.DUKA_ENV ?? "local";
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("duka_sidebar")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <Sidebar data-print-hide>
        <SidebarHeader className="border-b border-sidebar-border p-3">
          <Link
            href="/"
            className="flex min-h-12 items-center gap-3 rounded-lg px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 shadow-inner">
              <Store aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-bold tracking-tight">Duka Autopilot</span>
              <span className="block truncate text-xs text-sidebar-muted">Duka la Amani</span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="py-2">
          <DesktopNavigation />
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 group-data-[collapsible=icon]:grid group-data-[collapsible=icon]:place-items-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-300" />
              <span className="group-data-[collapsible=icon]:hidden">Authority policy</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-sidebar-muted group-data-[collapsible=icon]:hidden">Exact evidence moves. Ambiguity waits.</p>
          </div>
          <LogoutButton className="w-full justify-start text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <LogOut aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </LogoutButton>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <ControlRoomTopBar environment={environment} />
        <aside data-print-only className="hidden border-b px-4 py-3 text-xs">
          <span className="font-bold">Duka Autopilot · Duka la Amani</span>
          <span className="ml-3 text-muted-foreground">Evidence reflects the release identifiers visible on this page. External payment and supplier effects are not executed.</span>
        </aside>
        {/* A page that needs the whole viewport - the inbox thread - marks its
            root with data-fullbleed and this container drops its gutters. The
            page then owns its own bottom offset for the fixed mobile nav. */}
        <div className="mx-auto w-full max-w-[96rem] flex-1 px-4 pb-28 pt-6 md:px-7 md:pb-12 md:pt-8 xl:px-9 has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:px-0 has-[[data-fullbleed]]:pb-0 has-[[data-fullbleed]]:pt-0">
          {children}
        </div>
      </SidebarInset>

      <MobileNavigation />
    </SidebarProvider>
  );
}
