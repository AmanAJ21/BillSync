"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconDashboard,
  IconUsers,
  IconFileText,
  IconHistory,
  IconSettings,
  IconFileExport,
  IconCreditCard,
  IconShield,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Image from "next/image"

const adminNavData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: IconDashboard,
    },
    {
      title: "User Management",
      url: "/admin/users",
      icon: IconUsers,
    },
    {
      title: "Profile",
      url: "/admin/profile",
      icon: IconUsers,
    },
    {
      title: "Bill Management",
      url: "/admin/bills",
      icon: IconFileText,
    },
    {
      title: "Transactions",
      url: "/admin/transactions",
      icon: IconCreditCard,
    },
    {
      title: "Audit Logs",
      url: "/admin/audit-logs",
      icon: IconHistory,
    },
    {
      title: "Data Export",
      url: "/admin/export",
      icon: IconFileExport,
    },
    {
      title: "System Config",
      url: "/admin/config",
      icon: IconSettings,
    },
  ],
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/admin">
                <div className="flex items-center gap-2">
                  <Image src='/logo.png' alt='logo' width={24} height={24} />
                  <div className="flex flex-col">
                    <span className="text-base font-semibold">BillSync</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <IconShield className="h-3 w-3" />
                      Admin Panel
                    </span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={adminNavData.navMain} />
      </SidebarContent>
    </Sidebar>
  )
}