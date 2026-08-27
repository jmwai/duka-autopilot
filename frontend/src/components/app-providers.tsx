"use client";

import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "!border-border !bg-card !text-card-foreground",
            description: "!text-muted-foreground",
          },
        }}
      />
    </>
  );
}
