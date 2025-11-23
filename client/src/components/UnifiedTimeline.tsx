import { useState, useRef, useEffect, useCallback } from "react";
import { SLOT_TEMPLATE, SEAMLESS_PAIRS } from "@shared/schema";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

interface UnifiedTimelineProps {
  sceneType: 'cruising' | 'chase' | 'arrival';
  sceneDuration: number;
  slotSelections: SlotSelection[];
  activeSlot: number | null;
  onSlotClick: (slotNumber: number) => void;
  onWindowStartChange: (slotNumber: number, newStart: number) => void;
}

export default function UnifiedTimeline({
  sceneType,
  sceneDuration,
  slotSelections,
  activeSlot,
  onSlotClick,
  onWindowStartChange,
}: UnifiedTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  // Get slots for this scene type
  const sceneSlots = SLOT_TEMPLATE.filter(s => s.sceneType === sceneType);

  const formatTime = (seconds: number) => {
    if (seconds < 0) return "0:00.0";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, "0")}`;
  };

  // Convert pixel position to time
  const pixelToTime = useCallback((pixelX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, pixelX / rect.width));
    return percentage * sceneDuration;
  }, [sceneDuration]);

  // Convert time to percentage
  const timeToPercent = (time: number): number => {
    if (time < 0) return 0;
    return Math.max(0, (time / sceneDuration) * 100);
  };

  // Handle marker drag start
  const handleMouseDown = (e: React.MouseEvent, slotNumber: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingSlot(slotNumber);
    onSlotClick(slotNumber);
  };

  // Handle touch start for mobile
  const handleTouchStart = (e: React.TouchEvent, slotNumber: number) => {
    e.stopPropagation();
    setDraggingSlot(slotNumber);
    onSlotClick(slotNumber);
  };

  // Handle drag move
  useEffect(() => {
    if (draggingSlot === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pixelX = e.clientX - rect.left;
      const newTime = pixelToTime(pixelX);

      const slotConfig = sceneSlots.find(s => s.slotNumber === draggingSlot);
      if (!slotConfig) return;

      // Clamp to valid range
      const maxStart = Math.max(0, sceneDuration - slotConfig.duration);
      const clampedTime = Math.max(0, Math.min(maxStart, newTime));

      // Use finer precision for smoother dragging
      onWindowStartChange(draggingSlot, Math.round(clampedTime * 100) / 100);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!timelineRef.current || !e.touches[0]) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pixelX = e.touches[0].clientX - rect.left;
      const newTime = pixelToTime(pixelX);

      const slotConfig = sceneSlots.find(s => s.slotNumber === draggingSlot);
      if (!slotConfig) return;

      const maxStart = Math.max(0, sceneDuration - slotConfig.duration);
      const clampedTime = Math.max(0, Math.min(maxStart, newTime));
      onWindowStartChange(draggingSlot, Math.round(clampedTime * 100) / 100);
    };

    const handleEnd = () => {
      setDraggingSlot(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [draggingSlot, sceneDuration, sceneSlots, pixelToTime, onWindowStartChange]);

  // Generate time markers for the timeline
  const timeMarkers: number[] = [];
  const interval = sceneDuration > 120 ? 30 : sceneDuration > 60 ? 15 : 10;
  for (let i = 0; i <= sceneDuration; i += interval) {
    timeMarkers.push(i);
  }

  return (
    <div className="p-6 rounded-xl bg-card/30 backdrop-blur-md border border-card-border space-y-4">
      {/* Unified Timeline */}
      <div className="relative">
        {/* Time markers */}
        <div className="flex justify-between text-xs text-muted-foreground mb-2 px-1">
          {timeMarkers.map(time => (
            <span key={time}>{formatTime(time)}</span>
          ))}
        </div>

        {/* Main timeline track */}
        <div
          ref={timelineRef}
          className="relative h-24 bg-black/40 rounded-lg overflow-visible cursor-crosshair select-none"
          onClick={(e) => {
            if (draggingSlot !== null) return;
            // Allow clicking on timeline to position active slot
            if (activeSlot !== null && timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const pixelX = e.clientX - rect.left;
              const newTime = pixelToTime(pixelX);

              const slotConfig = sceneSlots.find(s => s.slotNumber === activeSlot);
              if (slotConfig) {
                const maxStart = Math.max(0, sceneDuration - slotConfig.duration);
                const clampedTime = Math.max(0, Math.min(maxStart, newTime));
                onWindowStartChange(activeSlot, Math.round(clampedTime * 100) / 100);
              }
            }
          }}
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 rounded-lg" />

          {/* Time grid lines */}
          {timeMarkers.map(time => (
            <div
              key={time}
              className="absolute top-0 h-full w-px bg-gray-600/30"
              style={{ left: `${timeToPercent(time)}%` }}
            />
          ))}

          {/* Slot markers and duration windows */}
          {sceneSlots.map(slot => {
            const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
            const windowStart = selection?.windowStart ?? 0;
            const isActive = activeSlot === slot.slotNumber;
            const isDragging = draggingSlot === slot.slotNumber;
            const isHovered = hoverSlot === slot.slotNumber;

            // Check if this slot is part of a seamless pair
            const seamlessPair = SEAMLESS_PAIRS.find(
              p => p.lead === slot.slotNumber || p.follow === slot.slotNumber
            );
            const isFollowSlot = seamlessPair?.follow === slot.slotNumber;

            // Skip rendering if windowStart is still uninitialized (-1)
            if (windowStart < 0) return null;

            return (
              <div key={slot.slotNumber}>
                {/* Duration window highlight */}
                <div
                  className={`absolute top-3 h-18 rounded-sm transition-all pointer-events-none ${
                    isActive ? 'opacity-100' : 'opacity-50'
                  }`}
                  style={{
                    left: `${timeToPercent(windowStart)}%`,
                    width: `${Math.max(timeToPercent(slot.duration), 2)}%`,
                    minWidth: '8px',
                    height: 'calc(100% - 24px)',
                    backgroundColor: `${slot.color}25`,
                    borderLeft: `3px solid ${slot.color}`,
                    borderRight: `1px solid ${slot.color}30`,
                  }}
                />

                {/* Draggable marker - larger touch target */}
                <div
                  className={`absolute top-0 h-full flex flex-col items-center select-none transition-transform ${
                    isDragging ? 'cursor-grabbing z-30' : isActive ? 'z-20 cursor-grab' : 'z-10 cursor-grab'
                  }`}
                  style={{
                    left: `${timeToPercent(windowStart)}%`,
                    transform: `translateX(-50%) ${isDragging ? 'scale(1.15)' : isActive ? 'scale(1.05)' : 'scale(1)'}`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, slot.slotNumber)}
                  onTouchStart={(e) => handleTouchStart(e, slot.slotNumber)}
                  onMouseEnter={() => setHoverSlot(slot.slotNumber)}
                  onMouseLeave={() => setHoverSlot(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotClick(slot.slotNumber);
                  }}
                >
                  {/* Invisible touch target - larger hit area */}
                  <div className="absolute -inset-x-3 inset-y-0" />

                  {/* Marker line */}
                  <div
                    className={`w-1 flex-1 transition-all rounded-full ${
                      isActive || isDragging ? 'w-1.5' : ''
                    }`}
                    style={{ backgroundColor: slot.color }}
                  />

                  {/* Slot number badge - larger and more visible */}
                  <div
                    className={`absolute top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all border-2 ${
                      isActive ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-background' : ''
                    }`}
                    style={{
                      backgroundColor: slot.color,
                      borderColor: isActive || isDragging ? '#fff' : `${slot.color}80`,
                      color: '#fff',
                      transform: isDragging ? 'scale(1.2)' : 'scale(1)'
                    }}
                  >
                    {slot.slotNumber}
                  </div>

                  {/* Camera indicator - shows on hover/active */}
                  <div
                    className={`absolute bottom-0 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                      isActive || isHovered || isDragging ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    }`}
                    style={{
                      backgroundColor: slot.color,
                      color: '#fff'
                    }}
                  >
                    C{slot.cameraAngle}
                  </div>
                </div>

                {/* Seamless pair connection line */}
                {seamlessPair && seamlessPair.lead === slot.slotNumber && (() => {
                  const followSelection = slotSelections.find(s => s.slotNumber === seamlessPair.follow);
                  const followStart = followSelection?.windowStart ?? 0;
                  if (followStart < 0) return null;
                  const lineWidth = followStart - (windowStart + slot.duration);
                  if (lineWidth <= 0) return null;
                  return (
                    <div
                      className="absolute top-1/2 h-1 bg-yellow-500/40 rounded pointer-events-none"
                      style={{
                        left: `${timeToPercent(windowStart + slot.duration)}%`,
                        width: `${timeToPercent(lineWidth)}%`,
                        transform: 'translateY(-50%)'
                      }}
                    />
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Legend - clickable slot buttons */}
        <div className="flex flex-wrap gap-3 mt-4 px-1">
          {sceneSlots.map(slot => {
            const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
            const isActive = activeSlot === slot.slotNumber;
            const seamlessPair = SEAMLESS_PAIRS.find(p => p.follow === slot.slotNumber);
            const windowStart = selection?.windowStart ?? 0;

            return (
              <button
                key={slot.slotNumber}
                onClick={() => onSlotClick(slot.slotNumber)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'ring-2 ring-primary bg-primary/10 scale-105'
                    : 'hover:bg-white/10 hover:scale-102'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: slot.color }}
                >
                  {slot.slotNumber}
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1">
                    Camera {slot.cameraAngle}
                    {seamlessPair && (
                      <span className="text-yellow-500" title="Auto-positioned after previous slot">
                        🔗
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {windowStart >= 0 ? formatTime(windowStart) : '--:--'} • {slot.duration.toFixed(2)}s
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
