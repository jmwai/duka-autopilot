"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 2_000 },
      mutations: { retry: false },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
