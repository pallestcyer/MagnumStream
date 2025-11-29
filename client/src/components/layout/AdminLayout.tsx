import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  Clock,
  Users,
  CheckCircle,
  UserX,
  Sun,
  Moon,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Packages", href: "/admin/packages", icon: Package },
  { label: "Time Analysis", href: "/admin/time-analysis", icon: Clock },
  { label: "Staff", href: "/admin/staff", icon: Users },
  { label: "Completion", href: "/admin/completion", icon: CheckCircle },
  { label: "Non-Buyers", href: "/admin/non-purchasers", icon: UserX },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const currentPage = NAV_ITEMS.find(n => n.href === location)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden transition-colors duration-300">
      {/* Floating Navbar */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
        <div className="flex items-center gap-3">
          {/* Dashboard Button - Left side, outside nav */}
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-10 px-4 text-sm font-medium hover:bg-accent border-border"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>

          <nav className="flex items-center justify-between bg-card/80 backdrop-blur-xl border border-border shadow-xl px-4 py-2 rounded-full transition-all duration-300">
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-current")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-full transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pl-4 pr-2 border-l border-border ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-accent"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full pt-24 md:pt-28 px-4 sm:px-8 pb-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header Info */}
          <div className="flex justify-between items-end pb-2 mb-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">Admin Dashboard</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 text-foreground">
                {currentPage}
              </h1>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-muted-foreground">Last updated</p>
              <p className="text-sm font-mono text-primary font-bold">Just now</p>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
