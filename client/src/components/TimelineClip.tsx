import { useState } from "react";
import { Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineClipProps {
  id: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  onPlay?: () => void;
  onDelete?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TimelineClip({ id, title, duration, thumbnailUrl, onPlay, onDelete }: TimelineClipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group rounded-lg overflow-hidden border border-card-border bg-card hover-elevate cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`clip-${id}`}
    >
      <div className="aspect-video bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center relative">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <Play className="w-8 h-8 text-muted-foreground mx-auto" />
          </div>
        )}
        
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                console.log(`Playing clip ${id}`);
                onPlay?.();
              }}
              data-testid={`button-play-${id}`}
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                console.log(`Deleting clip ${id}`);
                onDelete?.();
              }}
              data-testid={`button-delete-${id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs font-mono text-white">
          {formatDuration(duration)}
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
      </div>

      <div className="absolute top-2 left-2 w-3 h-full bg-primary cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-2 right-2 w-3 h-full bg-primary cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
