import { useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraPreviewProps {
  isRecording?: boolean;
  hasVideo?: boolean;
  videoUrl?: string;
}

export default function CameraPreview({ isRecording = false, hasVideo = false, videoUrl }: CameraPreviewProps) {
  const [cameraEnabled, setCameraEnabled] = useState(true);

  return (
    <div className="relative w-full aspect-video bg-card rounded-lg overflow-hidden border border-card-border">
      {hasVideo && videoUrl ? (
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          controls
          data-testid="video-preview"
        />
      ) : cameraEnabled ? (
        <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Camera Preview</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-card flex items-center justify-center">
          <div className="text-center">
            <CameraOff className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Camera Disabled</p>
          </div>
        </div>
      )}
      
      {isRecording && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/90 backdrop-blur-sm rounded-md">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse-record" />
            <span className="text-xs font-semibold text-white uppercase">Recording</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => {
            setCameraEnabled(!cameraEnabled);
            console.log(`Camera ${!cameraEnabled ? "enabled" : "disabled"}`);
          }}
          data-testid="button-toggle-camera"
        >
          {cameraEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
