"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function LogoutButton(props: React.ComponentProps<typeof Button>) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      {...props}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/auth/logout", { method: "POST" });
          if (!response.ok) {
            toast.error("Could not sign out. Please try again.");
            return;
          }
          router.replace("/login");
          router.refresh();
        });
      }}
    />
  );
}
