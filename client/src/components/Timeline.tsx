import TimelineClip from "./TimelineClip";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
}

interface TimelineProps {
  clips: Clip[];
  onPlayClip?: (id: string) => void;
  onDeleteClip?: (id: string) => void;
  onAutoTrim?: () => void;
}

export default function Timeline({ clips, onPlayClip, onDeleteClip, onAutoTrim }: TimelineProps) {
  if (clips.length === 0) return null;

  return (
    <div className="w-full bg-card/30 backdrop-blur-xl border-t border-card-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Timeline</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log("Auto-trim clicked");
            onAutoTrim?.();
          }}
          data-testid="button-auto-trim"
        >
          <Scissors className="w-4 h-4 mr-2" />
          Auto-trim
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            id={clip.id}
            title={clip.title}
            duration={clip.duration}
            thumbnailUrl={clip.thumbnailUrl}
            onPlay={() => onPlayClip?.(clip.id)}
            onDelete={() => onDeleteClip?.(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}
