import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface VideoTrimmerProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (value: number) => void;
  onTrimEndChange: (value: number) => void;
}

export default function VideoTrimmer({
  duration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
}: VideoTrimmerProps) {
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toFixed(2).padStart(5, "0")}`;
  };

  const getPercentage = (time: number) => (time / duration) * 100;

  const handleMouseDown = (type: "start" | "end") => (e: React.MouseEvent) => {
    e.preventDefault();
    if (type === "start") {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || (!isDraggingStart && !isDraggingEnd)) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const time = percentage * duration;

      if (isDraggingStart) {
        const newStart = Math.max(0, Math.min(time, trimEnd - 1));
        onTrimStartChange(newStart);
      } else if (isDraggingEnd) {
        const newEnd = Math.max(trimStart + 1, Math.min(time, duration));
        onTrimEndChange(newEnd);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    if (isDraggingStart || isDraggingEnd) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, duration, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]);

  const trimmedDuration = trimEnd - trimStart;
  const startPercentage = getPercentage(trimStart);
  const endPercentage = getPercentage(trimEnd);
  const trimmedWidth = endPercentage - startPercentage;

  // Generate frame thumbnails (visual representation)
  const frameCount = 12;
  const frames = Array.from({ length: frameCount }, (_, i) => i);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-mono">
          Full Duration: {formatTime(duration)}
        </div>
        <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500 rounded text-xs font-mono text-yellow-500">
          {formatTime(trimmedDuration)}
        </div>
      </div>

      <div
        ref={timelineRef}
        className="relative h-24 bg-black/40 rounded-lg overflow-hidden select-none"
        data-testid="video-trimmer"
      >
        {/* Frame thumbnails */}
        <div className="absolute inset-0 flex">
          {frames.map((frame) => (
            <div
              key={frame}
              className="flex-1 border-r border-gray-800/50 bg-gradient-to-br from-purple-900/10 to-blue-900/10 flex items-center justify-center"
            >
              <div className="w-full h-full opacity-20 bg-gradient-to-br from-purple-500 to-blue-500" />
            </div>
          ))}
        </div>

        {/* Dimmed overlay for untrimmed sections */}
        <div
          className="absolute top-0 left-0 h-full bg-black/60"
          style={{ width: `${startPercentage}%` }}
        />
        <div
          className="absolute top-0 right-0 h-full bg-black/60"
          style={{ width: `${100 - endPercentage}%` }}
        />

        {/* Trimmed section border */}
        <div
          className="absolute top-0 h-full border-2 border-yellow-500 pointer-events-none"
          style={{
            left: `${startPercentage}%`,
            width: `${trimmedWidth}%`,
          }}
        />

        {/* Start trim handle */}
        <div
          className="absolute top-0 h-full w-3 bg-yellow-500 cursor-ew-resize flex items-center justify-center hover-elevate active-elevate-2"
          style={{ left: `${startPercentage}%`, transform: "translateX(-50%)" }}
          onMouseDown={handleMouseDown("start")}
          data-testid="trim-handle-start"
        >
          <Plus className="w-3 h-3 text-black rotate-45" />
        </div>

        {/* End trim handle */}
        <div
          className="absolute top-0 h-full w-3 bg-yellow-500 cursor-ew-resize flex items-center justify-center hover-elevate active-elevate-2"
          style={{ left: `${endPercentage}%`, transform: "translateX(-50%)" }}
          onMouseDown={handleMouseDown("end")}
          data-testid="trim-handle-end"
        >
          <Plus className="w-3 h-3 text-black rotate-45" />
        </div>

        {/* Top trim indicators */}
        <div
          className="absolute -top-1 w-2 h-2 bg-yellow-500 rounded-sm transform rotate-45"
          style={{ left: `${startPercentage}%`, transform: "translateX(-50%) rotate(45deg)" }}
        />
        <div
          className="absolute -top-1 w-2 h-2 bg-yellow-500 rounded-sm transform rotate-45"
          style={{ left: `${endPercentage}%`, transform: "translateX(-50%) rotate(45deg)" }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>Start: {formatTime(trimStart)}</span>
        <span>End: {formatTime(trimEnd)}</span>
      </div>
    </div>
  );
}
