import {
  FileText,
  Settings,
  ShieldCheck,
  Users,
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

export default function Home() {
  const menuItems = [
    { label: "Documents", icon: FileText },
    { label: "Roles", icon: ShieldCheck },
    { label: "Employees", icon: Users },
    { label: "Settings", icon: Settings },
  ]

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
                    <SidebarMenuButton className="[&>svg]:size-[18px]">
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
        <header className="flex h-14 items-center border-b px-4">
          <h1 className="text-sm font-medium">Dashboard</h1>
        </header>
        <main className="flex-1 p-4">Hej</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
