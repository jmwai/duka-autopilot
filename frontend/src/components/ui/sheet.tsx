"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return <SheetPrimitive.Overlay data-slot="sheet-overlay" className={cn("fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px]", className)} {...props} />;
}

function SheetContent({ className, children, side = "right", showCloseButton = true, ...props }: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "top" | "right" | "bottom" | "left"; showCloseButton?: boolean }) {
  const sideClass = {
    top: "inset-x-0 top-0 max-h-[90svh] border-b",
    right: "inset-y-0 right-0 h-full w-[min(90vw,28rem)] border-l",
    bottom: "inset-x-0 bottom-0 max-h-[90svh] border-t",
    left: "inset-y-0 left-0 h-full w-[min(90vw,28rem)] border-r",
  }[side];
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Content data-slot="sheet-content" className={cn("fixed z-50 flex flex-col gap-4 bg-card p-6 text-card-foreground shadow-2xl outline-none", sideClass, className)} {...props}>
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close className="absolute right-4 top-4 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-lg font-semibold", className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
