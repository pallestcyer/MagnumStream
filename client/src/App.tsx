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
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

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
