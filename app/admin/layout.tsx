"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AuthGuard } from "@/components/auth-guard"
import { AdminGuard } from "@/components/admin-guard"

import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <AdminGuard>
                <SidebarProvider
                    style={
                        {
                            "--sidebar-width": "calc(var(--spacing) * 72)",
                            "--header-height": "calc(var(--spacing) * 12)",
                        } as React.CSSProperties
                    }
                >
                    <AdminSidebar variant="inset" />
                    <SidebarInset>
                        <main className="flex-1 min-w-100vh">
                            <AdminHeader />
                            {children}
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            </AdminGuard>
        </AuthGuard>
    )
}