import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

function Breadcrumb(props: React.ComponentProps<"nav">) { return <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />; }
function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) { return <ol data-slot="breadcrumb-list" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)} {...props} />; }
function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) { return <li data-slot="breadcrumb-item" className={cn("inline-flex items-center gap-1.5", className)} {...props} />; }
function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) { const Component = asChild ? Slot.Root : "a"; return <Component data-slot="breadcrumb-link" className={cn("transition-colors hover:text-foreground", className)} {...props} />; }
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) { return <span data-slot="breadcrumb-page" aria-current="page" className={cn("font-medium text-foreground", className)} {...props} />; }
function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) { return <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>{children ?? <ChevronRight />}</li>; }

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };
