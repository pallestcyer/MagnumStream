import { useLocation } from "wouter";
import { CheckCircle2, Circle } from "lucide-react";

interface Phase {
  id: string;
  label: string;
  path: string;
  order: number;
}

const PHASES: Phase[] = [
  { id: "info", label: "Info", path: "/", order: 1 },
  { id: "recording", label: "Recording", path: "/recording", order: 2 },
  { id: "editing", label: "Editing", path: "/editor/cruising", order: 3 },
  { id: "export", label: "Export & Share", path: "/history", order: 4 },
];

interface PhaseNavigationProps {
  currentPhase: string;
  completedPhases?: string[];
}

export default function PhaseNavigation({ currentPhase, completedPhases = [] }: PhaseNavigationProps) {
  const [, setLocation] = useLocation();

  const getCurrentPhaseOrder = () => {
    return PHASES.find(p => p.id === currentPhase)?.order || 1;
  };

  const isPhaseAccessible = (phase: Phase) => {
    // Always allow going back to previous phases
    // Allow going to editing at any time (skip ahead feature)
    return phase.order <= getCurrentPhaseOrder() || phase.id === "editing";
  };

  const isPhaseComplete = (phaseId: string) => {
    return completedPhases.includes(phaseId);
  };

  return (
    <div className="border-b border-border bg-card/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {PHASES.map((phase, index) => {
            const isCurrent = phase.id === currentPhase;
            const isComplete = isPhaseComplete(phase.id);
            const isAccessible = isPhaseAccessible(phase);
            
            return (
              <div key={phase.id} className="flex items-center flex-1">
                <button
                  onClick={() => isAccessible && setLocation(phase.path)}
                  disabled={!isAccessible}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full
                    ${isCurrent ? "bg-gradient-purple-blue text-white" : ""}
                    ${isComplete && !isCurrent ? "bg-orange-500/20 text-orange-500" : ""}
                    ${!isCurrent && !isComplete ? "hover-elevate" : ""}
                    ${!isAccessible ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  data-testid={`phase-nav-${phase.id}`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className={`w-5 h-5 ${isCurrent ? "fill-current" : ""}`} />
                  )}
                  <div className="text-left flex-1">
                    <div className="text-xs opacity-75">Step {phase.order}</div>
                    <div className="font-semibold">{phase.label}</div>
                  </div>
                </button>
                
                {index < PHASES.length - 1 && (
                  <div className="w-8 h-0.5 bg-border mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
