import { Check } from "lucide-react";

interface PhaseIndicatorProps {
  currentPhase: number;
  phases: { id: number; title: string; completed: boolean }[];
}

export default function PhaseIndicator({ currentPhase, phases }: PhaseIndicatorProps) {
  return (
    <div className="flex items-center gap-4">
      {phases.map((phase, index) => {
        const isActive = phase.id === currentPhase;
        const isCompleted = phase.completed;
        
        return (
          <div key={phase.id} className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-gradient-purple-blue text-white shadow-lg shadow-primary/50"
                    : "border-2 border-border text-muted-foreground"
                }`}
                data-testid={`phase-indicator-${phase.id}`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : phase.id}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Phase {phase.id} of {phases.length}
                </span>
                <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {phase.title}
                </span>
              </div>
            </div>
            {index < phases.length - 1 && (
              <div className={`w-12 h-0.5 ${isCompleted ? "bg-green-500" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
