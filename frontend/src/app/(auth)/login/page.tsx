import { Braces, Hand, Sparkles, Store } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="paper-noise relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10"><Store aria-hidden="true" className="size-5" /></span>
          <div><p className="font-bold">Duka Autopilot</p><p className="text-xs text-sidebar-muted">Duka la Amani · Mombasa</p></div>
        </div>
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Autonomous night shift</p>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-[-0.045em]">The duka slept.<br />Its back office did not.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-muted">Voice notes, handwritten ledgers and payment records become a quiet morning queue—with authority visible at every step.</p>
          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              { icon: Braces, label: "Exact", detail: "Evidence moves" },
              { icon: Sparkles, label: "Gemini", detail: "Mess gets bounded" },
              { icon: Hand, label: "Owner", detail: "Consequences wait" },
            ].map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <Icon aria-hidden="true" className="size-4.5 text-emerald-200" />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-sidebar-muted">{detail}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">Synthetic judging environment · No external money movement</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <Card className="w-full max-w-md bg-card/95 shadow-[0_20px_60px_oklch(0.25_0.04_75/0.12)]">
          <CardContent className="p-7 sm:p-9">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Store aria-hidden="true" className="size-4.5" /></span>
              <div><p className="text-sm font-bold">Duka Autopilot</p><p className="text-xs text-muted-foreground">Duka la Amani</p></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Owner access</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Start with the morning brief.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Review what completed autonomously, then decide only what needed human judgment.</p>
            <Suspense fallback={<div className="mt-7 h-52 animate-pulse rounded-xl bg-muted" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
