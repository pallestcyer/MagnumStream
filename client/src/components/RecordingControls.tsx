import { Circle, Square, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  hasRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetake: () => void;
}

export default function RecordingControls({
  isRecording,
  isPaused,
  hasRecording,
  onStart,
  onStop,
  onPause,
  onResume,
  onRetake,
}: RecordingControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {!isRecording && !hasRecording && (
        <Button
          size="lg"
          className="min-w-48 h-14 bg-gradient-purple-blue hover:opacity-90 text-white font-semibold text-base"
          onClick={onStart}
          data-testid="button-start-recording"
        >
          <Circle className="w-5 h-5 mr-2 fill-white" />
          Start Recording
        </Button>
      )}

      {isRecording && (
        <>
          <Button
            size="lg"
            variant="destructive"
            className="min-w-40"
            onClick={onStop}
            data-testid="button-stop-recording"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop
          </Button>
          
          {!isPaused ? (
            <Button
              size="lg"
              variant="secondary"
              onClick={onPause}
              data-testid="button-pause-recording"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              onClick={onResume}
              data-testid="button-resume-recording"
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
        </>
      )}

      {hasRecording && !isRecording && (
        <Button
          size="lg"
          variant="outline"
          onClick={onRetake}
          data-testid="button-retake"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retake
        </Button>
      )}
    </div>
  );
}
