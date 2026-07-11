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
        <SidebarInset className="isolate h-svh min-w-0 overflow-hidden">
          <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="absolute inset-0 z-0 min-h-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
