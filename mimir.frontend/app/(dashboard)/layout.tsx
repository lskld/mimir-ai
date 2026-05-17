"use client"

import {
  Eye,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
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
import { NewDocumentSheet } from "@/components/new-document-sheet"
import { usePathname, useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const menuItems = [
    { label: "Home", href: "/", icon: LayoutDashboard },
    { label: "Documents", href: "/vault", icon: FileText },
    { label: "Hierarchy", href: "/hierarchy", icon: ShieldCheck },
    {
      label: "Studio",
      href: "/studio",
      icon: GraduationCap,
    },
    {
      label: "Employees",
      href: "/preview",
      icon: Eye,
    },
  ]
  const isMenuItemActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`)
  const pageTitle =
    menuItems.find((item) => isMenuItemActive(item.href))?.label ?? "Home"

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="h-14 justify-center gap-0 border-b px-4 py-0">
          <div className="text-sm font-semibold">Mimir</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      className="cursor-pointer [&>svg]:size-[18px]"
                      isActive={isMenuItemActive(item.href)}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="h-14 justify-center gap-0 border-t px-4 py-0">
          <div />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <h1 className="text-sm font-medium">{pageTitle}</h1>
          {pathname === "/vault" ? <NewDocumentSheet /> : null}
        </header>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
