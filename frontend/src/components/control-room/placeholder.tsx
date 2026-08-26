import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { PageHeader } from "./page-header";

export function PlannedScreen({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Construction aria-hidden="true" className="size-5" />
          </span>
          <p className="font-semibold">Foundation route is ready</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            This screen is connected to the control-room shell. Its release contract is implemented in Phase F2.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
