import { CircleCheck, LogOut, Store } from "lucide-react";
import Link from "next/link";

import { DesktopNavigation, MobileNavigation } from "./navigation";
import { LogoutButton } from "./logout-button";

export function ControlRoomShell({ children }: { children: React.ReactNode }) {
  const environment = process.env.DUKA_ENV ?? "local";

  return (
    <div className="min-h-screen md:grid md:grid-cols-[17rem_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link
          href="/"
          className="mx-5 flex min-h-20 items-center gap-3 border-b border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-white/10 shadow-inner">
            <Store aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight">Duka Autopilot</span>
            <span className="block text-xs text-sidebar-muted">Duka la Amani</span>
          </span>
        </Link>

        <div className="flex-1 py-5">
          <DesktopNavigation />
        </div>

        <div className="m-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CircleCheck aria-hidden="true" className="size-4 text-emerald-300" />
            Autopilot ready
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-sidebar-muted">
            Exact evidence moves. Ambiguity waits.
          </p>
          <LogoutButton className="mt-3 w-full justify-start text-sidebar-muted hover:bg-white/10 hover:text-white">
            <LogOut aria-hidden="true" />
            Sign out
          </LogoutButton>
        </div>
      </aside>

      <div className="md:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store aria-hidden="true" className="size-4.5" />
            </span>
            <span className="text-sm font-bold">Duka Autopilot</span>
          </div>
          <p className="hidden text-sm text-muted-foreground md:block">
            The duka slept. Its back office did not.
          </p>
          <span className="rounded-full border bg-card px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {environment}
          </span>
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}
