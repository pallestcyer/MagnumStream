import { Video, Settings, Upload, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavigationSidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

export default function NavigationSidebar({ activeItem = "recording", onItemClick }: NavigationSidebarProps) {
  const navItems = [
    { id: "recording", icon: Video, label: "Recording" },
    { id: "settings", icon: Settings, label: "Settings" },
    { id: "export", icon: Upload, label: "Export" },
    { id: "help", icon: HelpCircle, label: "Help" },
  ];

  return (
    <div className="w-20 h-screen bg-sidebar border-r border-sidebar-border backdrop-blur-xl flex flex-col items-center py-6 gap-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;
        
        return (
          <Button
            key={item.id}
            size="icon"
            variant={isActive ? "default" : "ghost"}
            className={`w-14 h-14 relative group ${isActive ? "bg-gradient-purple-blue" : ""}`}
            onClick={() => {
              console.log(`${item.label} clicked`);
              onItemClick?.(item.id);
            }}
            data-testid={`button-nav-${item.id}`}
          >
            <Icon className="w-6 h-6" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {item.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
