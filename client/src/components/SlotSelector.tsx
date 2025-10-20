import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";

interface SlotSelectorProps {
  slotNumber: number;
  sceneDuration: number; // Total duration of the scene recording
  windowStart: number; // Current start time of the 3-second window
  onWindowStartChange: (newStart: number) => void;
  color: string; // Color for this slot
  sceneType: string; // 'cruising' | 'chase' | 'arrival'
  cameraAngle: number; // 1 or 2
}

export default function SlotSelector({
  slotNumber,
  sceneDuration,
  windowStart,
  onWindowStartChange,
  color,
  sceneType,
  cameraAngle,
}: SlotSelectorProps) {
  const SLOT_DURATION = 3; // Fixed 3-second slots
  const maxStart = Math.max(0, sceneDuration - SLOT_DURATION);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, "0")}:${secs.padStart(5, "0")}`;
  };

  const handleSliderChange = (value: number[]) => {
    const newStart = Math.min(value[0], maxStart);
    onWindowStartChange(newStart);
  };

  const windowEnd = Math.min(windowStart + SLOT_DURATION, sceneDuration);

  return (
    <div 
      className="p-4 rounded-lg border-2 hover-elevate"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
      data-testid={`slot-selector-${slotNumber}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="font-semibold text-foreground">
              Slot {slotNumber}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {sceneType} • Camera {cameraAngle}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-foreground">
            {formatTime(windowStart)} - {formatTime(windowEnd)}
          </div>
          <div className="text-xs text-muted-foreground">
            3.00s window
          </div>
        </div>
      </div>

      {/* Timeline with window selector */}
      <div className="space-y-2">
        <div className="relative h-12 bg-black/40 rounded overflow-hidden">
          {/* Full timeline background */}
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            <div className="w-full h-full bg-gradient-to-r from-gray-800/50 to-gray-700/50" />
          </div>

          {/* 3-second window highlight */}
          <div
            className="absolute top-0 h-full border-2 pointer-events-none"
            style={{
              left: `${(windowStart / sceneDuration) * 100}%`,
              width: `${(SLOT_DURATION / sceneDuration) * 100}%`,
              borderColor: color,
              backgroundColor: `${color}40`,
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs font-bold" style={{ color }}>
                3s
              </span>
            </div>
          </div>
        </div>

        {/* Slider control */}
        <div className="space-y-1">
          <Slider
            value={[windowStart]}
            onValueChange={handleSliderChange}
            max={maxStart}
            step={0.1}
            className="w-full"
            data-testid={`slider-slot-${slotNumber}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>0:00.00</span>
            <span>{formatTime(sceneDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
