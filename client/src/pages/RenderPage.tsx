import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PhaseNavigation from "@/components/PhaseNavigation";
import { usePilot } from "@/contexts/PilotContext";
import { useToast } from "@/hooks/use-toast";
import { SLOT_TEMPLATE } from "@shared/schema";
import { 
  ArrowLeft, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Clapperboard,
  Download,
  ArrowRight
} from "lucide-react";

type RenderStatus = "idle" | "generating_clips" | "creating_job" | "completed" | "error";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
}

export default function RenderPage() {
  const [location, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const { toast } = useToast();
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [generatedClips, setGeneratedClips] = useState<any[]>([]);

  const [allSlotSelections, setAllSlotSelections] = useState<SlotSelection[]>([]);

  // Load slot selections from API on component mount
  useEffect(() => {
    const loadSlotSelections = async () => {
      try {
        const recordingId = localStorage.getItem('currentRecordingId');
        if (recordingId) {
          const response = await fetch(`/api/recordings/${recordingId}/video-slots`);
          if (response.ok) {
            const slots = await response.json();
            const slotSelections = slots.map(slot => ({
              slotNumber: slot.slot_number,
              windowStart: slot.window_start,
              sceneType: getSceneTypeFromSlotNumber(slot.slot_number),
              cameraAngle: slot.camera_angle
            }));
            setAllSlotSelections(slotSelections);
            console.log(`📊 Loaded ${slotSelections.length} slot selections for render`);
          }
        }
      } catch (error) {
        console.error('Failed to load slot selections:', error);
      }
    };
    
    loadSlotSelections();
  }, []);

  const getSceneTypeFromSlotNumber = (slotNumber: number): 'cruising' | 'chase' | 'arrival' => {
    if (slotNumber >= 1 && slotNumber <= 3) return 'cruising';
    if (slotNumber >= 4 && slotNumber <= 6) return 'chase';
    if (slotNumber >= 7 && slotNumber <= 8) return 'arrival';
    throw new Error(`Invalid slot number: ${slotNumber}`);
  };

  const handleStartRender = async () => {
    try {
      setRenderStatus("generating_clips");
      setProgress(10);
      
      // Get current recording ID from localStorage
      const recordingId = localStorage.getItem('currentRecordingId');
      if (!recordingId) {
        throw new Error('No current recording found. Please start from the beginning.');
      }
      
      toast({
        title: "Starting Render Process",
        description: "Generating clips from your scene selections...",
      });
      
      // Generate clips using saved timeline positions (via local Mac server for FFmpeg)
      const clipResponse = await fetch(`http://localhost:3001/api/recordings/${recordingId}/generate-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // ClipGenerator will fetch slots from database
      });

      if (!clipResponse.ok) {
        throw new Error('Failed to generate clips');
      }

      const clipResult = await clipResponse.json();
      setGeneratedClips(clipResult.clips);
      setProgress(70);

      toast({
        title: "Clips Generated",
        description: `Successfully generated ${clipResult.clips.length} video clips`,
      });

      setRenderStatus("creating_job");

      // Create DaVinci job file (via local Mac server)
      const jobResponse = await fetch(`http://localhost:3001/api/recordings/${recordingId}/create-davinci-job`, {
        method: 'POST'
      });
      
      if (!jobResponse.ok) {
        throw new Error('Failed to create DaVinci job');
      }
      
      const jobResult = await jobResponse.json();
      setProgress(100);
      
      toast({
        title: "DaVinci Job Created",
        description: "Ready for automated video processing",
      });
      
      setRenderStatus("completed");
      
    } catch (error) {
      console.error('Render failed:', error);
      setRenderStatus("error");
      toast({
        title: "Render Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusInfo = () => {
    switch (renderStatus) {
      case "idle":
        return { icon: Play, text: "Ready to Render", color: "text-blue-500" };
      case "generating_clips":
        return { icon: Clock, text: "Generating Clips...", color: "text-orange-500" };
      case "creating_job":
        return { icon: Clock, text: "Creating DaVinci Job...", color: "text-orange-500" };
      case "completed":
        return { icon: CheckCircle2, text: "Render Complete", color: "text-green-500" };
      case "error":
        return { icon: AlertCircle, text: "Render Failed", color: "text-red-500" };
      default:
        return { icon: Play, text: "Ready", color: "text-gray-500" };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Check for autostart parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const autostart = urlParams.get('autostart');
    
    if (autostart === 'true' && renderStatus === 'idle') {
      console.log('🚀 Auto-starting render process...');
      setTimeout(() => {
        handleStartRender();
      }, 1000); // Small delay to ensure UI is ready
    }
  }, [renderStatus]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhaseNavigation currentPhase="rendering" completedPhases={["info", "recording", "editing"]} />

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Final Render</h1>
              <p className="text-muted-foreground mt-1">
                Project: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
                {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/editor/arrival")}
                disabled={renderStatus === "generating_clips" || renderStatus === "creating_job"}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Editing
              </Button>
              {renderStatus === "completed" && (
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="bg-gradient-purple-blue"
                >
                  Return to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Render Status */}
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Render Status</h2>
              <Badge variant="outline" className={statusInfo.color}>
                <StatusIcon className="w-4 h-4 mr-2" />
                {statusInfo.text}
              </Badge>
            </div>
            
            {renderStatus !== "idle" && renderStatus !== "error" && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-purple-blue h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {renderStatus === "idle" && (
              <div className="text-center py-8">
                <Clapperboard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-6">
                  Ready to generate clips from your scene selections and create the final video project.
                </p>
                <Button
                  size="lg"
                  onClick={handleStartRender}
                  className="bg-gradient-purple-blue"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Render Process
                </Button>
              </div>
            )}

            {renderStatus === "completed" && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Render Complete!</h3>
                <p className="text-muted-foreground mb-6">
                  Your video clips have been generated and the DaVinci Resolve project is ready for final processing.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Project Files
                  </Button>
                  <Button className="bg-gradient-purple-blue">
                    Open DaVinci Resolve
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Scene Summary */}
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Scene Summary</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {['cruising', 'chase', 'arrival'].map(sceneType => {
                const sceneSlots = allSlotSelections.filter(s => s.sceneType === sceneType);
                return (
                  <div key={sceneType} className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-foreground capitalize mb-2">{sceneType} Scene</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {sceneSlots.length} clips selected
                    </p>
                    <div className="space-y-2">
                      {sceneSlots.map(slot => {
                        const templateSlot = SLOT_TEMPLATE.find(t => t.slotNumber === slot.slotNumber);
                        return (
                          <div key={slot.slotNumber} className="flex items-center justify-between text-xs">
                            <span>Slot {slot.slotNumber} • Camera {slot.cameraAngle}</span>
                            <span className="font-mono">{slot.windowStart.toFixed(1)}s</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Generated Clips (shown after completion) */}
          {generatedClips.length > 0 && (
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">Generated Clips</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {generatedClips.map((clip, index) => (
                  <div key={index} className="p-3 border rounded text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Slot {clip.slotNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {clip.sceneType} • Camera {clip.cameraAngle}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {clip.filePath.split('/').pop()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}