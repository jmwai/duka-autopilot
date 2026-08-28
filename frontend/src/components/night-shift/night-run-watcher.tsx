"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { nightlyRunStatusSchema } from "@/lib/api/contracts";
import { browserApi } from "@/lib/api/browser-client";
import {
  clearPendingRun,
  completionMessage,
  failureMessage,
  hasExpired,
  isTerminal,
  PENDING_RUN_EVENT,
  readPendingRun,
  RUN_POLL_MS,
} from "@/lib/night-shift/pending-run";

/**
 * Watches a night run the owner started and tells them when it lands.
 *
 * It is mounted by the control room shell rather than by the night shift page
 * so the alert still arrives after the owner has walked off to the inbox —
 * which is the whole reason the run went to the worker in the first place.
 */
export function NightRunWatcher() {
  const router = useRouter();
  // Guards against two toasts for one run if a poll overlaps the next tick.
  const settledRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      const run = readPendingRun();
      if (!run || cancelled) return;

      if (hasExpired(run, Date.now())) {
        clearPendingRun();
        toast.warning("Stopped watching the night shift", {
          description: "It has run longer than expected. Open Night shift to see where it got to.",
        });
        return;
      }

      try {
        const status = await browserApi(
          `recon/nightly/status?run_id=${encodeURIComponent(run.runId)}`,
          nightlyRunStatusSchema,
        );
        if (cancelled || !isTerminal(status.status)) return;
        if (settledRef.current === run.runId) return;
        settledRef.current = run.runId;
        clearPendingRun();

        if (status.status === "completed") {
          const { title, detail } = completionMessage(status.report);
          toast.success(title, {
            description: detail,
            action: { label: "Open", onClick: () => router.push("/night-shift") },
          });
        } else {
          const { title, detail } = failureMessage(status);
          toast.error(title, { description: detail });
        }
        // The night shift page reads its report on the server, so a refresh is
        // what makes the finished run visible if the owner is already there.
        router.refresh();
      } catch {
        // A poll that fails is not a run that failed. Keep watching; the
        // deadline above is what eventually gives up.
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        await check();
        if (!cancelled) schedule();
      }, RUN_POLL_MS);
    }

    void check();
    schedule();
    window.addEventListener(PENDING_RUN_EVENT, check);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(PENDING_RUN_EVENT, check);
    };
  }, [router]);

  return null;
}
