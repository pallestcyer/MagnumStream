import { Camera } from "lucide-react";
import { useState, useEffect } from "react";

interface DeviceSelectorProps {
  selectedCamera1?: string;
  selectedCamera2?: string;
  onCamera1Change?: (value: string) => void;
  onCamera2Change?: (value: string) => void;
}

// Fixed camera configuration - these will be set in environment variables
const CAMERA_CONFIG = {
  camera1: {
    // This will be set from environment variable CAMERA_1_DEVICE_ID
    deviceId: process.env.CAMERA_1_DEVICE_ID || "default-camera-1",
    label: "Camera 1 (Straight View)"
  },
  camera2: {
    // This will be set from environment variable CAMERA_2_DEVICE_ID  
    deviceId: process.env.CAMERA_2_DEVICE_ID || "default-camera-2",
    label: "Camera 2 (Side View)"
  }
};

export default function DeviceSelector({
  selectedCamera1,
  selectedCamera2,
  onCamera1Change,
  onCamera2Change,
}: DeviceSelectorProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Auto-assign the configured cameras on component mount
    if (!isInitialized) {
      console.log('🎥 Using configured camera setup:');
      console.log('Camera 1 (Straight):', CAMERA_CONFIG.camera1.deviceId);
      console.log('Camera 2 (Side):', CAMERA_CONFIG.camera2.deviceId);
      
      if (!selectedCamera1 && onCamera1Change) {
        onCamera1Change(CAMERA_CONFIG.camera1.deviceId);
      }
      if (!selectedCamera2 && onCamera2Change) {
        onCamera2Change(CAMERA_CONFIG.camera2.deviceId);
      }
      
      setIsInitialized(true);
    }
  }, [selectedCamera1, selectedCamera2, onCamera1Change, onCamera2Change, isInitialized]);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Camera 1 (Straight View):</span>
        <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-md border">
          <span className="text-xs font-mono text-green-700 dark:text-green-300">
            {CAMERA_CONFIG.camera1.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Camera 2 (Side View):</span>
        <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md border">
          <span className="text-xs font-mono text-blue-700 dark:text-blue-300">
            {CAMERA_CONFIG.camera2.label}
          </span>
        </div>
      </div>
      
      <div className="text-xs text-green-600 font-medium">
        ✅ Fixed Camera Setup
      </div>
    </div>
  );
}
