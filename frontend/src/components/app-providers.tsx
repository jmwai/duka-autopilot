"use client";

import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        // The control room's top bar is a 4rem sticky header; the default
        // 32px offset drops the toast on top of it.
        offset={{ top: "5rem", right: "1rem" }}
        mobileOffset={{ top: "5rem", left: "1rem", right: "1rem" }}
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
