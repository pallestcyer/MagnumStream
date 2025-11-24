import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PilotProvider } from "@/contexts/PilotContext";
import InfoPage from "@/pages/InfoPage";
import RecordingDashboard from "@/pages/RecordingDashboard";
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

const ACCESS_CODE = "1414";

function PasscodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("magnum_authenticated") === "true";
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (!isAuthenticated) {
    return <PasscodeGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PilotProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-2 border-b border-border bg-card/30 backdrop-blur-md">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </PilotProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
