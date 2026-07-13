"use client"

import * as React from "react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { InboxIcon, FileIcon, SendIcon, ArchiveXIcon, Trash2Icon, TerminalIcon } from "lucide-react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "Inbox", icon: <InboxIcon /> },
    { title: "Drafts", icon: <FileIcon /> },
    { title: "Sent", icon: <SendIcon /> },
    { title: "Junk", icon: <ArchiveXIcon /> },
    { title: "Trash", icon: <Trash2Icon /> },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* This is the main sidebar: it collapses to the gutter and starts expanded. */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="group/logo">
            <SidebarMenuButton
              size="lg"
              className="md:h-8 md:pr-9 md:pl-0"
              render={<a href="#" aria-label="Home" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:group-hover/logo:invisible">
                <TerminalIcon className="size-4" />
              </div>
              <span>QuakeStrike</span>
            </SidebarMenuButton>
            {/* This trigger controls the main sidebar only; nested sidebar work is deferred. */}
            <SidebarTrigger className="absolute top-1/2 right-1 -translate-y-1/2 opacity-100 group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:m-auto group-data-[collapsible=icon]:translate-y-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:group-hover/logo:opacity-100" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={{ children: item.title, hidden: false }}
                    onClick={() => setActiveItem(item)}
                    isActive={activeItem.title === item.title}
                    className="px-2.5 md:px-2"
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
