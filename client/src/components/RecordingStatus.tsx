import { Circle } from "lucide-react";

interface RecordingStatusProps {
  isRecording: boolean;
  elapsedTime: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function RecordingStatus({ isRecording, elapsedTime }: RecordingStatusProps) {
  if (!isRecording && elapsedTime === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card/50 backdrop-blur-md rounded-md border border-card-border">
      {isRecording && (
        <div className="flex items-center gap-2">
          <Circle className="w-3 h-3 fill-destructive text-destructive animate-pulse-record" />
          <span className="text-sm font-semibold text-destructive uppercase tracking-wide">REC</span>
        </div>
      )}
      <span className="text-sm font-mono font-semibold text-foreground" data-testid="text-elapsed-time">
        {formatTime(elapsedTime)}
      </span>
    </div>
  );
}
