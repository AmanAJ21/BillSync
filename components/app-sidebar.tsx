"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconDashboard,
  IconInnerShadowTop,
  IconPolaroidFilled,
  IconUsers,
  IconBolt,
  IconCreditCard,
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

const data = {

  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Profile",
      url: "/dashboard/profile",
      icon: IconUsers,
    },
    {
      title: "Bill",
      url: "/dashboard/bill",
      icon: IconUsers,
    },
    {
      title: "Auto-Payments",
      url: "/dashboard/auto-payments",
      icon: IconBolt,
    },
    {
      title: "Payment History",
      url: "/dashboard/payments",
      icon: IconCreditCard,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <Image src='/logo.png' alt='logo' width={24} height={24} />
                <span className="text-base font-semibold">BillSync</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
    </Sidebar>
  )
}
