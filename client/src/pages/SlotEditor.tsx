import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Download, Play } from "lucide-react";
import NavigationSidebar from "@/components/NavigationSidebar";
import Header from "@/components/Header";
import FlightMetadataDialog from "@/components/FlightMetadataDialog";
import ExportWorkflow from "@/components/ExportWorkflow";
import SlotSelector from "@/components/SlotSelector";
import { SLOT_TEMPLATE, SlotConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface SceneData {
  id: string;
  type: 'cruising' | 'chase' | 'arrival';
  camera1Url: string;
  camera2Url: string;
  duration: number;
}

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

export default function SlotEditor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeNav, setActiveNav] = useState("recording");
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [flightMetadata, setFlightMetadata] = useState({ date: "", time: "" });

  // Mock scene data - in real app, this would come from recording
  const [scenes] = useState<SceneData[]>([
    { id: "1", type: "cruising", camera1Url: "", camera2Url: "", duration: 45 },
    { id: "2", type: "chase", camera1Url: "", camera2Url: "", duration: 60 },
    { id: "3", type: "arrival", camera1Url: "", camera2Url: "", duration: 30 },
  ]);

  // Initialize slot selections with defaults
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: 0,
    }))
  );

  const handleWindowStartChange = (slotNumber: number, newStart: number) => {
    setSlotSelections(prev =>
      prev.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, windowStart: newStart }
          : slot
      )
    );
  };

  const getSceneData = (sceneType: 'cruising' | 'chase' | 'arrival'): SceneData => {
    return scenes.find(s => s.type === sceneType) || scenes[0];
  };

  const handleSave = () => {
    toast({
      title: "Selections Saved",
      description: "Your slot selections have been saved successfully.",
    });
  };

  const handleExportClick = () => {
    setShowMetadataDialog(true);
  };

  const handleMetadataSubmit = (flightDate: string, flightTime: string) => {
    setFlightMetadata({ date: flightDate, time: flightTime });
    setShowExportDialog(true);
  };

  // Group slots by scene
  const cruisingSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising');
  const chaseSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'chase');
  const arrivalSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'arrival');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavigationSidebar activeItem={activeNav} onItemClick={setActiveNav} />

      <div className="flex-1 flex flex-col">
        <Header projectName="Flight Video Editor" onExport={handleExportClick} />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Back button and header */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setLocation("/recording")}
                data-testid="button-back-to-recording"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Recording
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  data-testid="button-save-selections"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Selections
                </Button>
                <Button
                  className="bg-gradient-purple-blue"
                  onClick={handleExportClick}
                  data-testid="button-export-video"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Video
                </Button>
              </div>
            </div>

            {/* Dual Preview Area */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Edited Video Preview
                </h3>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-primary/50">
                  <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                    <div className="text-center">
                      <Play className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Your edited flight video</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Background Template
                </h3>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-muted/50">
                  <div className="w-full h-full bg-gradient-to-br from-gray-900/20 to-gray-800/20 flex items-center justify-center">
                    <div className="text-center">
                      <Play className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Static background template</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slot Editors */}
            <div className="space-y-8">
              {/* Cruising Scene Slots */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-blue-500 rounded-full" />
                  <h2 className="text-2xl font-semibold text-foreground">Cruising Scene</h2>
                  <span className="text-sm text-muted-foreground">
                    ({cruisingSlots.length} slots)
                  </span>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {cruisingSlots.map(slot => {
                    const sceneData = getSceneData('cruising');
                    const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
                    return (
                      <SlotSelector
                        key={slot.slotNumber}
                        slotNumber={slot.slotNumber}
                        sceneDuration={sceneData.duration}
                        windowStart={selection?.windowStart || 0}
                        onWindowStartChange={(newStart) => handleWindowStartChange(slot.slotNumber, newStart)}
                        color={slot.color}
                        sceneType={slot.sceneType}
                        cameraAngle={slot.cameraAngle}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Chase Scene Slots */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-purple-500 rounded-full" />
                  <h2 className="text-2xl font-semibold text-foreground">Chase Scene</h2>
                  <span className="text-sm text-muted-foreground">
                    ({chaseSlots.length} slots)
                  </span>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {chaseSlots.map(slot => {
                    const sceneData = getSceneData('chase');
                    const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
                    return (
                      <SlotSelector
                        key={slot.slotNumber}
                        slotNumber={slot.slotNumber}
                        sceneDuration={sceneData.duration}
                        windowStart={selection?.windowStart || 0}
                        onWindowStartChange={(newStart) => handleWindowStartChange(slot.slotNumber, newStart)}
                        color={slot.color}
                        sceneType={slot.sceneType}
                        cameraAngle={slot.cameraAngle}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Arrival Scene Slots */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-green-500 rounded-full" />
                  <h2 className="text-2xl font-semibold text-foreground">Arrival Scene</h2>
                  <span className="text-sm text-muted-foreground">
                    ({arrivalSlots.length} slots)
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {arrivalSlots.map(slot => {
                    const sceneData = getSceneData('arrival');
                    const selection = slotSelections.find(s => s.slotNumber === slot.slotNumber);
                    return (
                      <SlotSelector
                        key={slot.slotNumber}
                        slotNumber={slot.slotNumber}
                        sceneDuration={sceneData.duration}
                        windowStart={selection?.windowStart || 0}
                        onWindowStartChange={(newStart) => handleWindowStartChange(slot.slotNumber, newStart)}
                        color={slot.color}
                        sceneType={slot.sceneType}
                        cameraAngle={slot.cameraAngle}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <FlightMetadataDialog
        open={showMetadataDialog}
        onOpenChange={setShowMetadataDialog}
        onSubmit={handleMetadataSubmit}
      />

      <ExportWorkflow
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        flightDate={flightMetadata.date}
        flightTime={flightMetadata.time}
      />
    </div>
  );
}
