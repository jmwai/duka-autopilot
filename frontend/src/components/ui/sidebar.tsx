"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import { Slot } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE_NAME = "duka_sidebar";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within SidebarProvider.");
  return context;
}

function SidebarProvider({ defaultOpen = true, className, style, children, ...props }: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const isMobile = useIsMobile();
  const [open, setOpenState] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>((value) => {
    setOpenState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((current) => !current);
    else setOpen((current) => !current);
  }, [isMobile, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state: SidebarContextValue["state"] = open ? "expanded" : "collapsed";
  const value = React.useMemo(() => ({ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }), [state, open, setOpen, openMobile, isMobile, toggleSidebar]);

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={100}>
        <div
          data-slot="sidebar-wrapper"
          style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "4.25rem", ...style } as React.CSSProperties}
          className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

function Sidebar({ className, children, ...props }: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" showCloseButton={false} className="w-(--sidebar-width) gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Navigate Duka Autopilot.</SheetDescription></SheetHeader>
          <div className="flex h-full min-h-0 flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="group peer hidden text-sidebar-foreground md:block" data-state={state} data-collapsible={state === "collapsed" ? "icon" : ""} data-side="left" {...props}>
      <div className="relative w-(--sidebar-width) transition-[width] duration-200 ease-out group-data-[collapsible=icon]:w-(--sidebar-width-icon)" />
      <div className={cn("fixed inset-y-0 left-0 z-40 hidden h-svh w-(--sidebar-width) border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex group-data-[collapsible=icon]:w-(--sidebar-width-icon)", className)}>
        <div data-sidebar="sidebar" className="flex h-full w-full min-w-0 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("relative flex min-w-0 flex-1 flex-col bg-background", className)} {...props} />;
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9", className)}
      onClick={(event) => { onClick?.(event); toggleSidebar(); }}
      {...props}
    >
      <PanelLeft aria-hidden="true" />
      <span className="sr-only">Toggle navigation</span>
    </Button>
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return <button type="button" tabIndex={-1} aria-label="Toggle navigation" title="Toggle navigation" onClick={toggleSidebar} className={cn("absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-w-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px hover:after:bg-sidebar-border md:block", className)} {...props} />;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex shrink-0 flex-col gap-2 p-3", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex shrink-0 flex-col gap-2 p-3", className)} {...props} />;
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex min-w-0 flex-col px-3 py-2", className)} {...props} />;
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-label" className={cn("flex h-7 items-center px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sidebar-muted transition-[opacity,height] group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:opacity-0", className)} {...props} />;
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full", className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("relative", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "flex min-h-10 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-left text-sm font-medium text-sidebar-muted outline-none transition-[background-color,color,width,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 [&>svg]:size-4.5 [&>svg]:shrink-0 [&>span]:truncate group-data-[collapsible=icon]:[&>span]:hidden",
  { variants: { size: { default: "", lg: "min-h-12" } }, defaultVariants: { size: "default" } },
);

function SidebarMenuButton({ asChild = false, isActive = false, tooltip, className, size, ...props }: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean; tooltip?: string } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Component = asChild ? Slot.Root : "button";
  const { isMobile, state } = useSidebar();
  const button = <Component data-slot="sidebar-menu-button" data-active={isActive} className={cn(sidebarMenuButtonVariants({ size }), className)} {...props} />;
  if (!tooltip) return button;
  return <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>{tooltip}</TooltipContent></Tooltip>;
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
};
