import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhaseNavigation from "@/components/PhaseNavigation";
import FlightMetadataDialog from "@/components/FlightMetadataDialog";
import ExportWorkflow from "@/components/ExportWorkflow";
import SlotSelector from "@/components/SlotSelector";
import { SLOT_TEMPLATE } from "@shared/schema";
import { usePilot } from "@/contexts/PilotContext";
import { ArrowLeft, Download, Play, Volume2, VolumeX } from "lucide-react";
import { videoStorage } from "@/utils/videoStorage";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

export default function EditorArrival() {
  const [, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [flightMetadata, setFlightMetadata] = useState({ date: "", time: "" });
  const [sceneVideos, setSceneVideos] = useState<{camera1?: string, camera2?: string, duration?: number}>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.filter(s => s.sceneType === 'arrival').map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: 0,
    }))
  );
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  const arrivalSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'arrival');
  
  // Load timeline positions on component mount
  useEffect(() => {
    const loadTimelinePositions = async () => {
      try {
        const recordingId = localStorage.getItem('currentRecordingId');
        if (recordingId) {
          setCurrentRecordingId(recordingId);
          
          // Fetch existing video slots for this recording (arrival scene only)
          const response = await fetch(`/api/recordings/${recordingId}/video-slots`);
          if (response.ok) {
            const existingSlots = await response.json();
            const arrivalSlots = existingSlots.filter(s => {
              const slotConfig = SLOT_TEMPLATE.find(t => t.slotNumber === s.slot_number);
              return slotConfig?.sceneType === 'arrival';
            });
            
            if (arrivalSlots.length > 0) {
              setSlotSelections(prev => 
                prev.map(slot => {
                  const existingSlot = arrivalSlots.find(s => s.slot_number === slot.slotNumber);
                  return existingSlot 
                    ? { ...slot, windowStart: existingSlot.window_start }
                    : slot;
                })
              );
              console.log('Loaded timeline positions for arrival slots:', arrivalSlots);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load timeline positions:', error);
      }
    };
    
    loadTimelinePositions();
  }, []);

  // Load recorded videos on component mount
  useEffect(() => {
    const loadVideos = async () => {
      try {
        const duration = localStorage.getItem('scene_arrival_duration');
        
        console.log('Loading arrival scene videos from IndexedDB...');
        
        // Debug: Check current session
        const currentSessionId = localStorage.getItem('currentSessionId');
        console.log('🔍 Current session ID for arrival scene:', currentSessionId);
        
        // Load videos from IndexedDB
        const camera1Blob = await videoStorage.getVideo('arrival', 1);
        const camera2Blob = await videoStorage.getVideo('arrival', 2);
        const videoDuration = await videoStorage.getVideoDuration('arrival');
        
        console.log('Loaded arrival scene videos:', {
          camera1: camera1Blob ? `Available (${camera1Blob.size} bytes)` : 'Missing',
          camera2: camera2Blob ? `Available (${camera2Blob.size} bytes)` : 'Missing',
          duration: videoDuration || (duration ? parseFloat(duration) : 30)
        });
        
        // Convert blobs to object URLs
        const videos: {camera1?: string, camera2?: string, duration?: number} = {
          duration: videoDuration || (duration ? parseFloat(duration) : 30)
        };
        
        if (camera1Blob) {
          videos.camera1 = URL.createObjectURL(camera1Blob);
          console.log('🎬 Created arrival camera 1 object URL');
        }
        
        if (camera2Blob) {
          videos.camera2 = URL.createObjectURL(camera2Blob);
          console.log('🎬 Created arrival camera 2 object URL');
        }
        
        if (videos.camera1 || videos.camera2) {
          setSceneVideos(videos);
        } else {
          // No videos found for current session, clear any existing videos
          console.log('🔄 No arrival videos found for current session, clearing display');
          setSceneVideos({});
        }
      } catch (error) {
        console.error('❌ Failed to load arrival videos from IndexedDB:', error);
      }
    };
    
    loadVideos();
  }, []);

  const handleWindowStartChange = async (slotNumber: number, newStart: number) => {
    // Update local state immediately for responsive UI
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
    
    // Save to database
    if (currentRecordingId) {
      try {
        const response = await fetch(`/api/recordings/${currentRecordingId}/video-slots/${slotNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ windowStart: newStart })
        });
        
        if (response.ok) {
          console.log(`Saved timeline position for arrival slot ${slotNumber}: ${newStart}s`);
        } else {
          console.error('Failed to save timeline position:', response.statusText);
        }
      } catch (error) {
        console.error('Error saving timeline position:', error);
      }
    }
  };

  const handleSlotClick = (slotNumber: number) => {
    setActiveSlot(slotNumber);
    const selection = slotSelections.find(s => s.slotNumber === slotNumber);
    const slotConfig = arrivalSlots.find(s => s.slotNumber === slotNumber);
    
    if (videoRef.current && selection && slotConfig) {
      // Load the appropriate camera video, fallback to camera 1 if camera 2 not available
      let videoUrl = slotConfig.cameraAngle === 1 ? sceneVideos.camera1 : sceneVideos.camera2;
      
      // Fallback: if requested camera not available, use camera 1
      if (!videoUrl && slotConfig.cameraAngle === 2 && sceneVideos.camera1) {
        videoUrl = sceneVideos.camera1;
        console.log(`🔄 Camera 2 not available for slot ${slotConfig.slotNumber}, using Camera 1 as fallback`);
      }
      
      console.log(`🎯 Arrival: Loading video for camera ${slotConfig.cameraAngle}:`, videoUrl ? videoUrl.substring(0, 50) + '...' : 'No URL');
      
      if (videoUrl) {
        try {
          videoRef.current.src = videoUrl;
          videoRef.current.currentTime = selection.windowStart;
          
          // Wait for video to load before playing
          videoRef.current.addEventListener('loadeddata', () => {
            console.log('✅ Arrival video loaded successfully, starting playback at', selection.windowStart);
            if (videoRef.current) {
              videoRef.current.currentTime = selection.windowStart;
              videoRef.current.play().catch(error => {
                console.error('❌ Error playing arrival video:', error);
              });
            }
          }, { once: true });
          
          // Add error handling
          videoRef.current.addEventListener('error', (event) => {
            const video = event.target as HTMLVideoElement;
            console.error('❌ Arrival video load error:', {
              error: video.error,
              errorCode: video.error?.code,
              errorMessage: video.error?.message,
              canPlayType: {
                mp4: video.canPlayType('video/mp4'),
                mp4_h264: video.canPlayType('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'),
                webm: video.canPlayType('video/webm')
              }
            });
          }, { once: true });
          
          // Load the video
          videoRef.current.load();
        } catch (error) {
          console.error('Error loading video:', error);
        }
      } else {
        console.warn(`No video available for camera ${slotConfig.cameraAngle} in arrival scene`);
      }
    }
  };


  const handleMetadataSubmit = (flightDate: string, flightTime: string, pilotName?: string) => {
    setFlightMetadata({ date: flightDate, time: flightTime });

    // Update the recording with actual pilot name if provided
    if (pilotName) {
      const recordingId = localStorage.getItem('currentRecordingId');
      if (recordingId) {
        fetch(`/api/recordings/${recordingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flightPilot: pilotName, // Actual pilot who flew the aircraft
            flightDate: flightDate,
            flightTime: flightTime
          })
        }).then(response => {
          if (response.ok) {
            console.log('📊 Updated recording with flight pilot:', pilotName);
          } else {
            console.warn('⚠️ Failed to update recording with flight pilot');
          }
        }).catch(error => {
          console.error('❌ Error updating recording:', error);
        });
      }
    }

    setShowMetadataDialog(false);
    setShowExportDialog(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const selection = slotSelections.find(s => s.slotNumber === activeSlot);
      if (selection) {
        // Get the duration for this slot from SLOT_TEMPLATE
        const slotConfig = SLOT_TEMPLATE.find(config => config.slotNumber === selection.slotNumber);
        const slotDuration = slotConfig?.duration || 3; // Fallback to 3 seconds if not found
        
        if (video.currentTime >= selection.windowStart + slotDuration) {
          video.pause();
          video.currentTime = selection.windowStart;
        }
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Arrival Scene Editor</h1>
              <p className="text-muted-foreground mt-1">
                Customers: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
                {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/editor/chase")}
                data-testid="button-back-chase"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back: Chase
              </Button>
              <Button
                onClick={() => setShowMetadataDialog(true)}
                className="bg-gradient-purple-blue"
                data-testid="button-proceed-render"
              >
                <Download className="w-4 h-4 mr-2" />
                Proceed to Render
              </Button>
            </div>
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
                    Slot {activeSlot} • Camera {arrivalSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
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
              <div className="relative aspect-video bg-gradient-to-br from-gray-950 to-gray-900 rounded-lg overflow-hidden border-2 border-orange-500/50">
                {activeSlot && (
                  <div className="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded text-sm text-white">
                    Slot {activeSlot} • Arrival • Camera {arrivalSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-green-500 rounded-full" />
              <h2 className="text-2xl font-semibold text-foreground">Select 3-Second Windows</h2>
              <span className="text-sm text-muted-foreground">
                (Click a slot to activate and preview)
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {arrivalSlots.map(slot => {
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
                      sceneDuration={sceneVideos.duration || 30}
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
