import { Camera, Mic } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DeviceSelectorProps {
  selectedCamera?: string;
  selectedMicrophone?: string;
  onCameraChange?: (value: string) => void;
  onMicrophoneChange?: (value: string) => void;
}

export default function DeviceSelector({
  selectedCamera,
  selectedMicrophone,
  onCameraChange,
  onMicrophoneChange,
}: DeviceSelectorProps) {
  //todo: remove mock functionality
  const cameras = [
    { id: "default", name: "Default Camera" },
    { id: "webcam", name: "HD Webcam" },
    { id: "external", name: "External Camera" },
  ];

  const microphones = [
    { id: "default", name: "Default Microphone" },
    { id: "headset", name: "Headset Microphone" },
    { id: "usb", name: "USB Microphone" },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Select
          value={selectedCamera || "default"}
          onValueChange={(value) => {
            console.log("Camera changed to:", value);
            onCameraChange?.(value);
          }}
        >
          <SelectTrigger className="w-48 h-9 bg-card/50 backdrop-blur-md" data-testid="select-camera">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cameras.map((camera) => (
              <SelectItem key={camera.id} value={camera.id}>
                {camera.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Mic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Select
          value={selectedMicrophone || "default"}
          onValueChange={(value) => {
            console.log("Microphone changed to:", value);
            onMicrophoneChange?.(value);
          }}
        >
          <SelectTrigger className="w-48 h-9 bg-card/50 backdrop-blur-md" data-testid="select-microphone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {microphones.map((mic) => (
              <SelectItem key={mic.id} value={mic.id}>
                {mic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
