import { Camera } from "lucide-react";
import { useState, useEffect } from "react";

interface DeviceSelectorProps {
  selectedCamera1?: string;
  selectedCamera2?: string;
  onCamera1Change?: (value: string) => void;
  onCamera2Change?: (value: string) => void;
}

interface CameraConfig {
  camera1: {
    deviceId: string;
    label: string;
  };
  camera2: {
    deviceId: string;
    label: string;
  };
}

export default function DeviceSelector({
  selectedCamera1,
  selectedCamera2,
  onCamera1Change,
  onCamera2Change,
}: DeviceSelectorProps) {
  const [cameraConfig, setCameraConfig] = useState<CameraConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Fetch camera configuration from server
    const fetchCameraConfig = async () => {
      try {
        const response = await fetch('/api/camera-config');
        const config = await response.json();
        console.log('🎥 Fetched camera configuration:', config);
        setCameraConfig(config);
        
        // Auto-assign the configured cameras
        if (!isInitialized) {
          if (!selectedCamera1 && onCamera1Change) {
            onCamera1Change(config.camera1.deviceId);
          }
          if (!selectedCamera2 && onCamera2Change) {
            onCamera2Change(config.camera2.deviceId);
          }
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('❌ Failed to fetch camera config:', error);
        // Fallback to default config
        const fallbackConfig = {
          camera1: { deviceId: "default-camera-1", label: "Camera 1 (Straight View)" },
          camera2: { deviceId: "default-camera-2", label: "Camera 2 (Side View)" }
        };
        setCameraConfig(fallbackConfig);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCameraConfig();
  }, [selectedCamera1, selectedCamera2, onCamera1Change, onCamera2Change, isInitialized]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground">Loading camera configuration...</div>
      </div>
    );
  }

  if (!cameraConfig) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-xs text-red-600">Failed to load camera configuration</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Camera 1 (Straight View):</span>
        <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-md border">
          <span className="text-xs font-mono text-green-700 dark:text-green-300">
            {cameraConfig.camera1.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Camera 2 (Side View):</span>
        <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md border">
          <span className="text-xs font-mono text-blue-700 dark:text-blue-300">
            {cameraConfig.camera2.label}
          </span>
        </div>
      </div>
      
      <div className="text-xs text-green-600 font-medium">
        ✅ Fixed Camera Setup
      </div>
    </div>
  );
}
