"use client";

import { FileCheck2 } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import type { DemoLedgerFixture } from "@/lib/fixtures/demo";

export type SelectedLedgerDocument = {
  id: string;
  eventId: string;
  file: File;
  fixture: DemoLedgerFixture | null;
  /** Owned by the chooser, which creates and revokes it in event handlers. */
  previewUrl: string;
};

export function DocumentStage({ selected }: { selected: SelectedLedgerDocument }) {
  const width = selected.fixture?.width ?? 1024;
  const height = selected.fixture?.height ?? 1536;

  return (
    <figure className="overflow-hidden rounded-xl border bg-[linear-gradient(90deg,var(--border)_1px,transparent_1px),linear-gradient(var(--border)_1px,transparent_1px)] bg-[size:22px_22px] p-2">
      <div className="relative overflow-hidden rounded-lg bg-card shadow-sm">
        <Image
          unoptimized
          src={selected.previewUrl}
          width={width}
          height={height}
          alt="Selected handwritten ledger page"
          className="max-h-[34rem] w-full object-contain"
        />
        {selected.fixture ? (
          <Badge variant="exact" className="absolute left-3 top-3 shadow-sm">
            <FileCheck2 aria-hidden="true" className="size-3.5" /> Google fixture verified
          </Badge>
        ) : null}
      </div>
    </figure>
  );
}
