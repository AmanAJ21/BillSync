"use client";

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeSwitch } from "./ui/theme-switch-button"
import { useAuth } from "@/contexts/auth-context"
import { LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/dashboard/profile':
        return 'Profile';
      case '/dashboard/analytics':
        return 'Analytics';
      case '/dashboard/api':
        return 'API Keys';
      case '/dashboard/data':
        return 'Data Records';
      case '/dashboard/money':
        return 'Payments';
      case '/dashboard/logs':
        return 'System Logs';
      case '/dashboard/documentation':
        return 'Documentation';
      default:
        return 'Dashboard';
    }
  };

  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        // Always show header at the top
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down - hide header
        setIsVisible(false);
      } else {
        // Scrolling up - show header
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader, { passive: true });

    return () => {
      window.removeEventListener('scroll', controlHeader);
    };
  }, [lastScrollY]);

  return (
    <header className={cn(
      "sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-all duration-300 ease-in-out bg-background",
      "group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
      isVisible ? "translate-y-0" : "-translate-y-full"
    )}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{getPageTitle()}</h1>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="text-sm text-muted-foreground">
              Welcome, {user.name}
            </span>
          )}
          <ThemeSwitch />
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
