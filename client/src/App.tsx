import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PilotProvider } from "@/contexts/PilotContext";
import InfoPage from "@/pages/InfoPage";
import RecordingDashboard from "@/pages/RecordingDashboard";
import EditorCruising from "@/pages/EditorCruising";
import EditorChase from "@/pages/EditorChase";
import EditorArrival from "@/pages/EditorArrival";
import SlotEditor from "@/pages/SlotEditor";
import HistoryPage from "@/pages/HistoryPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={InfoPage} />
      <Route path="/recording" component={RecordingDashboard} />
      <Route path="/editor/cruising" component={EditorCruising} />
      <Route path="/editor/chase" component={EditorChase} />
      <Route path="/editor/arrival" component={EditorArrival} />
      <Route path="/editor" component={EditorCruising} />
      <Route path="/history" component={HistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PilotProvider>
          <Toaster />
          <Router />
        </PilotProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
