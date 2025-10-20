import { useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CameraPreviewProps {
  isRecording?: boolean;
  hasVideo?: boolean;
  camera1Url?: string;
  camera2Url?: string;
}

export default function CameraPreview({ isRecording = false, hasVideo = false, camera1Url, camera2Url }: CameraPreviewProps) {
  const [camera1Enabled, setCamera1Enabled] = useState(true);
  const [camera2Enabled, setCamera2Enabled] = useState(true);
  const [activeCamera, setActiveCamera] = useState<1 | 2>(1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`relative aspect-video bg-card rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
            activeCamera === 1 ? "border-primary shadow-lg shadow-primary/30" : "border-card-border"
          }`}
          onClick={() => setActiveCamera(1)}
          data-testid="camera-preview-1"
        >
          {hasVideo && camera1Url ? (
            <video
              src={camera1Url}
              className="w-full h-full object-cover"
              controls
            />
          ) : camera1Enabled ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Camera 1</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center">
              <div className="text-center">
                <CameraOff className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Camera 1 Off</p>
              </div>
            </div>
          )}
          
          {activeCamera === 1 && (
            <div className="absolute top-2 left-2">
              <Badge variant="default" className="bg-primary">Active</Badge>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/90 backdrop-blur-sm rounded-md">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-record" />
                <span className="text-xs font-semibold text-white">REC</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-2 right-2">
            <Button
              size="icon"
              variant="secondary"
              className="w-8 h-8"
              onClick={(e) => {
                e.stopPropagation();
                setCamera1Enabled(!camera1Enabled);
                console.log(`Camera 1 ${!camera1Enabled ? "enabled" : "disabled"}`);
              }}
              data-testid="button-toggle-camera-1"
            >
              {camera1Enabled ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        <div
          className={`relative aspect-video bg-card rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
            activeCamera === 2 ? "border-primary shadow-lg shadow-primary/30" : "border-card-border"
          }`}
          onClick={() => setActiveCamera(2)}
          data-testid="camera-preview-2"
        >
          {hasVideo && camera2Url ? (
            <video
              src={camera2Url}
              className="w-full h-full object-cover"
              controls
            />
          ) : camera2Enabled ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Camera 2</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center">
              <div className="text-center">
                <CameraOff className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Camera 2 Off</p>
              </div>
            </div>
          )}
          
          {activeCamera === 2 && (
            <div className="absolute top-2 left-2">
              <Badge variant="default" className="bg-primary">Active</Badge>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/90 backdrop-blur-sm rounded-md">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-record" />
                <span className="text-xs font-semibold text-white">REC</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-2 right-2">
            <Button
              size="icon"
              variant="secondary"
              className="w-8 h-8"
              onClick={(e) => {
                e.stopPropagation();
                setCamera2Enabled(!camera2Enabled);
                console.log(`Camera 2 ${!camera2Enabled ? "enabled" : "disabled"}`);
              }}
              data-testid="button-toggle-camera-2"
            >
              {camera2Enabled ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>Click a camera to set as active view</p>
        <Badge variant="outline">{activeCamera === 1 ? "Camera 1 Active" : "Camera 2 Active"}</Badge>
      </div>
    </div>
  );
}
