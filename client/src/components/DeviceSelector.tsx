import { Camera } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DeviceSelectorProps {
  selectedCamera1?: string;
  selectedCamera2?: string;
  onCamera1Change?: (value: string) => void;
  onCamera2Change?: (value: string) => void;
}

export default function DeviceSelector({
  selectedCamera1,
  selectedCamera2,
  onCamera1Change,
  onCamera2Change,
}: DeviceSelectorProps) {
  //todo: remove mock functionality
  const camera1Options = [
    { id: "0", name: "Elgato 4K X (Camera 1)" },
    { id: "1", name: "Elgato 4K X (Camera 2)" },
  ];

  const camera2Options = [
    { id: "0", name: "Elgato 4K X (Camera 1)" },
    { id: "1", name: "Elgato 4K X (Camera 2)" },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Cam 1:</span>
        <Select
          value={selectedCamera1 || "0"}
          onValueChange={(value) => {
            console.log("Camera 1 changed to:", value);
            onCamera1Change?.(value);
          }}
        >
          <SelectTrigger className="w-40 h-9 bg-card/50 backdrop-blur-md" data-testid="select-camera-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {camera1Options.map((camera) => (
              <SelectItem key={camera.id} value={camera.id}>
                {camera.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Cam 2:</span>
        <Select
          value={selectedCamera2 || "1"}
          onValueChange={(value) => {
            console.log("Camera 2 changed to:", value);
            onCamera2Change?.(value);
          }}
        >
          <SelectTrigger className="w-40 h-9 bg-card/50 backdrop-blur-md" data-testid="select-camera-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {camera2Options.map((camera) => (
              <SelectItem key={camera.id} value={camera.id}>
                {camera.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
