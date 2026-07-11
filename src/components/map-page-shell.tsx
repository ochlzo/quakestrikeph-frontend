import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

type MapPageShellProps = {
  children: ReactNode
}

export function MapPageShell({ children }: MapPageShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={{ "--sidebar-width": "350px" } as CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="isolate min-w-0 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
