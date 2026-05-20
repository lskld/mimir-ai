"use client"

import {
  BookOpen,
  Building2,
  FileText,
  LayoutDashboard,
  Workflow,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type MenuItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** Description shown to humans, not in the nav. */
  hint?: string
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Organization", href: "/organization", icon: Building2 },
  { label: "Training", href: "/training", icon: Workflow },
  { label: "Programs", href: "/programs", icon: BookOpen },
]

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()

  const isMenuItemActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-border">
        <SidebarHeader className="h-16 justify-center gap-0 border-b border-border px-4 py-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--blue-glow)]">
              <span className="font-heading text-lg font-bold leading-none">
                M
              </span>
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="font-heading text-sm font-semibold leading-tight tracking-tight">
                Mimir AI
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Compliance training
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-1.5 py-2">
                {MENU_ITEMS.map((item) => {
                  const active = isMenuItemActive(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => router.push(item.href)}
                        className={cn(
                          "relative h-9 cursor-pointer rounded-md pl-3 text-sm [&>svg]:size-[18px]",
                          // override default active bg with surface-elevated +
                          // blue left-border indicator per spec
                          active
                            ? "bg-surface-elevated! text-foreground! before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary"
                            : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                        )}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Version
            </p>
            <p className="text-xs text-foreground/80">
              v0.1.0 — Hackathon Build
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background">
        <main className="min-h-screen flex-1 p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
