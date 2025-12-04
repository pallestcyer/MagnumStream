import { useState, useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PilotProvider } from "@/contexts/PilotContext";
import { PhotoUploadProvider } from "@/contexts/PhotoUploadContext";
import { PhotoUploadProgress } from "@/components/PhotoUploadProgress";
import { DevModeProvider, useDevMode } from "@/contexts/DevModeContext";
import InfoPage from "@/pages/InfoPage";
import RecordingDashboard from "@/pages/RecordingDashboard";
import CustomerIntakePage from "@/pages/CustomerIntakePage";
import EditorCruising from "@/pages/EditorCruising";
import EditorChase from "@/pages/EditorChase";
import EditorArrival from "@/pages/EditorArrival";
import RenderPage from "@/pages/RenderPage";
import SlotEditor from "@/pages/SlotEditor";
import SalesPage from "@/pages/SalesPage";
import HistoryPage from "@/pages/HistoryPage";
import ManualPage from "@/pages/ManualPage";
import ChatPage from "@/pages/ChatPage";
import IssuesPage from "@/pages/IssuesPage";
import ProjectsPage from "@/pages/ProjectsPage";
import NotFound from "@/pages/not-found";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "next-themes";
import { Shield, Wrench } from "lucide-react";
import AdminOverview from "@/pages/admin/Overview";
import AdminPackages from "@/pages/admin/Packages";
import AdminTimeAnalysis from "@/pages/admin/TimeAnalysis";
import AdminStaff from "@/pages/admin/Staff";
import AdminCompletion from "@/pages/admin/Completion";
import AdminNonPurchasers from "@/pages/admin/NonPurchasers";

// Obscured codes - not plaintext for basic security
const verifyCode = (input: string, hash: number) => {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input.charCodeAt(i) * (i + 1);
  }
  return sum === hash;
};
const ACCESS_HASH = 508; // Validates access code
const ADMIN_HASH = 530;  // Validates admin code

function AdminPasscodeGate({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode(code, ADMIN_HASH)) {
      onSuccess();
    } else {
      setError(true);
      setCode("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-xl">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Admin Access</h2>
          <p className="text-muted-foreground text-sm mt-1">Enter admin code to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Admin code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className={`text-center text-xl tracking-widest ${error ? "border-red-500" : ""}`}
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-sm text-center">Incorrect code</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Enter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasscodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode(code, ACCESS_HASH)) {
      sessionStorage.setItem("magnum_authenticated", "true");
      onSuccess();
    } else {
      setError(true);
      setCode("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">MagnumStream</h1>
          <p className="text-muted-foreground mt-2">Enter access code to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Access code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className={`text-center text-2xl tracking-widest ${error ? "border-red-500" : ""}`}
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-sm text-center">Incorrect code</p>
          )}
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProjectsPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/recording" component={RecordingDashboard} />
      <Route path="/editor/cruising" component={EditorCruising} />
      <Route path="/editor/chase" component={EditorChase} />
      <Route path="/editor/arrival" component={EditorArrival} />
      <Route path="/editor" component={EditorCruising} />
      <Route path="/render" component={RenderPage} />
      {/* Sales and Info pages hidden - functionality merged into Projects */}
      <Route path="/history" component={HistoryPage} />
      <Route path="/manual" component={ManualPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/issues" component={IssuesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/packages" component={AdminPackages} />
      <Route path="/admin/time-analysis" component={AdminTimeAnalysis} />
      <Route path="/admin/staff" component={AdminStaff} />
      <Route path="/admin/completion" component={AdminCompletion} />
      <Route path="/admin/non-purchasers" component={AdminNonPurchasers} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HeaderContent({ onAdminClick }: { onAdminClick: () => void }) {
  const { isDevMode, toggleDevMode } = useDevMode();

  return (
    <header className="flex items-center gap-2 p-2 border-b border-border bg-card/30 backdrop-blur-md">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <Button
        variant="outline"
        size="sm"
        onClick={onAdminClick}
        className="flex items-center gap-2"
      >
        <Shield className="w-4 h-4" />
        Admin
      </Button>
      <div className="flex-1" />
      <Button
        variant={isDevMode ? "default" : "ghost"}
        size="sm"
        onClick={toggleDevMode}
        className={`flex items-center gap-2 ${isDevMode ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-muted-foreground"}`}
      >
        <Wrench className="w-4 h-4" />
        {isDevMode ? "Dev Mode ON" : "Dev"}
      </Button>
    </header>
  );
}

function App() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("magnum_authenticated") === "true";
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const prevLocationRef = useRef(location);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const isAdminRoute = location.startsWith("/admin");
  const wasAdminRoute = prevLocationRef.current.startsWith("/admin");
  const isIntakeRoute = location === "/intake";

  // Clear admin authentication when leaving admin area
  useEffect(() => {
    if (wasAdminRoute && !isAdminRoute) {
      // User left admin area - clear admin auth
      setIsAdminAuthenticated(false);
    }
    prevLocationRef.current = location;
  }, [location, isAdminRoute, wasAdminRoute]);

  const handleAdminClick = () => {
    if (isAdminAuthenticated) {
      setLocation("/admin");
    } else {
      setShowAdminGate(true);
    }
  };

  const handleAdminSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowAdminGate(false);
    setLocation("/admin");
  };

  // Admin routes have their own authentication - don't require main passcode
  if (isAdminRoute) {
    if (!isAdminAuthenticated) {
      return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AdminPasscodeGate
            onSuccess={() => setIsAdminAuthenticated(true)}
            onCancel={() => setLocation("/")}
          />
        </ThemeProvider>
      );
    }
    // Admin is authenticated, show admin area
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <div className="min-h-screen bg-background">
              <AdminRouter />
            </div>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  // Customer intake page is publicly accessible (no passcode required)
  if (isIntakeRoute) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <div className="min-h-screen bg-background">
              <CustomerIntakePage />
            </div>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  // Main dashboard requires main passcode
  if (!isAuthenticated) {
    return <PasscodeGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PhotoUploadProvider>
            <DevModeProvider>
              <PilotProvider>
                  <SidebarProvider style={style as React.CSSProperties}>
                    <div className="flex h-screen w-full">
                      <AppSidebar />
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <HeaderContent onAdminClick={handleAdminClick} />
                        <main className="flex-1 overflow-auto">
                          <Router />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                  {showAdminGate && (
                    <AdminPasscodeGate
                      onSuccess={handleAdminSuccess}
                      onCancel={() => setShowAdminGate(false)}
                    />
                  )}
                  <Toaster />
                </PilotProvider>
              </DevModeProvider>
              <PhotoUploadProgress />
            </PhotoUploadProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
