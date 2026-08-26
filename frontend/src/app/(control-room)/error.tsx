"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <Card>
      <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-5" />
        </span>
        <h1 className="text-xl font-bold">This view could not be assembled.</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          No operational values were guessed. Retry the validated read, or use the release identifier when checking logs.
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Retry view
        </Button>
      </CardContent>
    </Card>
  );
}
