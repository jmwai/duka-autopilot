"use client";

import { useEffect } from "react";

import { FailureState } from "@/components/control-room/product-states";

export default function ControlRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("control-room render failed", { digest: error.digest });
  }, [error]);

  return <FailureState title="This view could not be assembled." description="No operational values were guessed. Retry the validated read, or use the release identifier when checking logs." requestId={error.digest} onRetry={reset} />;
}
