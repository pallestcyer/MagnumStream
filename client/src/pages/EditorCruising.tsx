import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhaseNavigation from "@/components/PhaseNavigation";
import SlotSelector from "@/components/SlotSelector";
import { SLOT_TEMPLATE } from "@shared/schema";
import { usePilot } from "@/contexts/PilotContext";
import { ArrowRight, Play, Volume2, VolumeX } from "lucide-react";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

export default function EditorCruising() {
  const [, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising').map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: 0,
    }))
  );

  // Mock scene data
  const sceneData = { duration: 45 };
  const cruisingSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising');

  const handleWindowStartChange = (slotNumber: number, newStart: number) => {
    setSlotSelections(prev =>
      prev.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, windowStart: newStart }
          : slot
      )
    );
    
    // Update video preview
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
    }
  };

  const handleSlotClick = (slotNumber: number) => {
    setActiveSlot(slotNumber);
    const selection = slotSelections.find(s => s.slotNumber === slotNumber);
    
    // Play preview from the window start
    if (videoRef.current && selection) {
      videoRef.current.currentTime = selection.windowStart;
      videoRef.current.play();
    }
  };

  // Stop video after 3 seconds
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const selection = slotSelections.find(s => s.slotNumber === activeSlot);
      if (selection && video.currentTime >= selection.windowStart + 3) {
        video.pause();
        video.currentTime = selection.windowStart;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [activeSlot, slotSelections]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhaseNavigation currentPhase="editing" completedPhases={["info", "recording"]} />

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cruising Scene Editor</h1>
              <p className="text-muted-foreground mt-1">
                Pilot: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
                {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
              </p>
            </div>
            <Button
              onClick={() => setLocation("/editor/chase")}
              className="bg-gradient-purple-blue"
              data-testid="button-next-chase"
            >
              Next: Chase Scene
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Dual Preview */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: 3-Second Clip Preview */}
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  3-Second Clip Preview
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMuted(!isMuted)}
                  data-testid="button-toggle-mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted={isMuted}
                  data-testid="video-slot-preview"
                />
                {!activeSlot && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Play className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click a slot to preview</p>
                    </div>
                  </div>
                )}
                {activeSlot && (
                  <div className="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded text-sm text-white">
                    Slot {activeSlot} • Camera {cruisingSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
                  </div>
                )}
              </div>
            </Card>

            {/* Right: Background Template Context */}
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Background Template
                </h2>
              </div>
              <div className="relative aspect-video bg-gradient-to-br from-blue-950 to-cyan-950 rounded-lg overflow-hidden border-2 border-blue-500/50">
                {activeSlot && (
                  <div className="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded text-sm text-white">
                    Slot {activeSlot} • Cruising • Camera {cruisingSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Slot Selectors */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-blue-500 rounded-full" />
              <h2 className="text-2xl font-semibold text-foreground">Select 3-Second Windows</h2>
              <span className="text-sm text-muted-foreground">
                (Click a slot to activate and preview)
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {cruisingSlots.map(slot => {
                const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
                const isActive = activeSlot === slot.slotNumber;
                return (
                  <div
                    key={slot.slotNumber}
                    onClick={() => handleSlotClick(slot.slotNumber)}
                    className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                    data-testid={`slot-card-${slot.slotNumber}`}
                  >
                    <SlotSelector
                      slotNumber={slot.slotNumber}
                      sceneDuration={sceneData.duration}
                      windowStart={selection?.windowStart || 0}
                      onWindowStartChange={(newStart) => handleWindowStartChange(slot.slotNumber, newStart)}
                      color={slot.color}
                      sceneType={slot.sceneType}
                      cameraAngle={slot.cameraAngle}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
