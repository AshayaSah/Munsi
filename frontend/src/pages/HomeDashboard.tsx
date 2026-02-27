import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ModeToggle } from "@/components/theme/mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const ROUTE_META: Record<string, { section: string; page: string }> = {
  "/home/messenger": { section: "Messenger", page: "Conversations" },
  "/home/auto_messenger": { section: "Webhook", page: "AI Agent & Events" },
};

const DEFAULT_META = { section: "Home", page: "Dashboard" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const { pathname } = useLocation();
  const meta = ROUTE_META[pathname] ?? DEFAULT_META;

  return (
    // h-screen keeps the entire layout locked to the viewport
    <SidebarProvider className="h-screen overflow-hidden">
      <AppSidebar collapsible="icon" />

      {/* SidebarInset must fill remaining height without overflowing */}
      <SidebarInset className="flex flex-col min-h-0 overflow-hidden">
        {/* Header — fixed height, never shrinks */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center justify-between gap-2 px-4">
            <div className="flex items-center">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/home/messenger">
                      {meta.section}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{meta.page}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <ModeToggle />
          </div>
        </header>

        {/*
          Content area:
          - flex-1 + min-h-0 lets it shrink to fill remaining space after the header
          - overflow-hidden prevents the container itself from scrolling
          - The Outlet (MessengerTab) handles its own internal scrolling
        */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-4 pt-3">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
