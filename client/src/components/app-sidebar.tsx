import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  MessageSquare,
  AlertCircle,
  Plane,
  FolderKanban
} from "lucide-react";

const menuItems = [
  {
    title: "Projects",
    url: "/",
    icon: FolderKanban,
  },
  {
    title: "Manual",
    url: "/manual",
    icon: BookOpen,
  },
  // {
  //   title: "AI Chat",
  //   url: "/chat",
  //   icon: MessageSquare,
  // },
  {
    title: "Report Issue",
    url: "/issues",
    icon: AlertCircle,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Magnum Helicopters"
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <h2 className="font-bold text-sidebar-foreground">Magnum Dashboard</h2>
            <p className="text-xs text-sidebar-foreground/60">Video Platform</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url ||
                  location === "/projects" && item.url === "/" ||
                  (item.url === "/" && (location.startsWith("/recording") || location.startsWith("/editor")));

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60">
          <p>Version 1.0.0</p>
          <p className="mt-1">© 2025 Magnum Dashboard</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
