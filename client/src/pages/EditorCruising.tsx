import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhaseNavigation from "@/components/PhaseNavigation";
import SlotSelector from "@/components/SlotSelector";
import { SLOT_TEMPLATE } from "@shared/schema";
import { usePilot } from "@/contexts/PilotContext";
import { ArrowRight, Play, Volume2, VolumeX } from "lucide-react";
import { videoStorage } from "@/utils/videoStorage";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

export default function EditorCruising() {
  const [, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [sceneVideos, setSceneVideos] = useState<{camera1?: string, camera2?: string, duration?: number}>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising').map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: 0,
    }))
  );
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  // Load recorded scene data
  const cruisingSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising');
  
  // Load timeline positions on component mount
  useEffect(() => {
    const loadTimelinePositions = async () => {
      try {
        const recordingId = localStorage.getItem('currentRecordingId');
        if (recordingId) {
          setCurrentRecordingId(recordingId);
          
          // Fetch existing video slots for this recording (cruising scene only)
          const response = await fetch(`/api/recordings/${recordingId}/video-slots`);
          console.log('Video slots API response status:', response.status, response.statusText);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('Response content-type:', contentType);
            
            let existingSlots = [];
            if (contentType && contentType.includes('application/json')) {
              existingSlots = await response.json();
              console.log('Loaded existing video slots from API:', existingSlots);
            } else {
              console.warn('API returned non-JSON response, likely an error page');
              const responseText = await response.text();
              console.error('Non-JSON response first 500 chars:', responseText.substring(0, 500));
              return; // Exit early if response is not JSON
            }
            
            const cruisingSlots = existingSlots.filter(s => {
              const slotConfig = SLOT_TEMPLATE.find(t => t.slotNumber === s.slot_number);
              return slotConfig?.sceneType === 'cruising';
            });
            
            if (cruisingSlots.length > 0) {
              setSlotSelections(prev => 
                prev.map(slot => {
                  const existingSlot = cruisingSlots.find(s => s.slot_number === slot.slotNumber);
                  return existingSlot 
                    ? { ...slot, windowStart: existingSlot.window_start }
                    : slot;
                })
              );
              console.log('Loaded timeline positions for cruising slots:', cruisingSlots);
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
        // Mark project as in_progress when editing begins
        await videoStorage.updateProjectStatus('in_progress');
        console.log('📊 Project marked as in_progress');
        
        const duration = localStorage.getItem('scene_cruising_duration');
        
        console.log('Loading cruising scene videos from IndexedDB...');
        
        // Debug: Check current session
        const currentSessionId = localStorage.getItem('currentSessionId');
        console.log('🔍 Current session ID for cruising scene:', currentSessionId);
        
        // Load videos from IndexedDB
        const camera1Blob = await videoStorage.getVideo('cruising', 1);
        const camera2Blob = await videoStorage.getVideo('cruising', 2);
        const videoDuration = await videoStorage.getVideoDuration('cruising');
        
        console.log('Loaded cruising scene videos:', {
          camera1: camera1Blob ? `Available (${camera1Blob.size} bytes)` : 'Missing',
          camera2: camera2Blob ? `Available (${camera2Blob.size} bytes)` : 'Missing',
          duration: videoDuration || (duration ? parseFloat(duration) : 60)
        });
        
        // Convert blobs to object URLs
        const videos: {camera1?: string, camera2?: string, duration?: number} = {
          duration: videoDuration || (duration ? parseFloat(duration) : 60)
        };
        
        if (camera1Blob) {
          console.log('🔍 Cruising camera 1 blob details:', {
            size: camera1Blob.size,
            type: camera1Blob.type,
            constructor: camera1Blob.constructor.name
          });
          
          // Test blob validity - can we read any data from it?
          try {
            const testSlice = camera1Blob.slice(0, 100);
            console.log('🧪 Blob slice test successful:', testSlice.size);
          } catch (error) {
            console.error('❌ Blob slice test failed:', error);
          }
          
          videos.camera1 = URL.createObjectURL(camera1Blob);
          console.log('🎬 Created cruising camera 1 object URL:', {
            size: camera1Blob.size,
            type: camera1Blob.type,
            url: videos.camera1
          });
        }
        
        if (camera2Blob) {
          videos.camera2 = URL.createObjectURL(camera2Blob);
          console.log('🎬 Created camera 2 object URL');
        }
        
        if (videos.camera1 || videos.camera2) {
          setSceneVideos(videos);
        } else {
          // No videos found for current session, clear any existing videos
          console.log('🔄 No cruising videos found for current session, clearing display');
          setSceneVideos({});
        }
      } catch (error) {
        console.error('❌ Failed to load videos from IndexedDB:', error);
      }
    };
    
    loadVideos();
  }, []);

  const handleWindowStartChange = async (slotNumber: number, newStart: number) => {
    console.log(`🔄 EditorCruising: Changing slot ${slotNumber} to ${newStart}s`);
    console.log(`🔄 Current recording ID: ${currentRecordingId}`);
    
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
        console.log(`💾 Saving cruising slot ${slotNumber} position ${newStart}s to API...`);
        const response = await fetch(`/api/recordings/${currentRecordingId}/video-slots/${slotNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ windowStart: newStart })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Saved cruising timeline position for slot ${slotNumber}: ${newStart}s`, result);
        } else {
          console.error('❌ Failed to save cruising timeline position:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
        }
      } catch (error) {
        console.error('❌ Error saving cruising timeline position:', error);
      }
    } else {
      console.warn('⚠️ No current recording ID - cannot save cruising timeline position');
    }
  };

  const handleSlotClick = (slotNumber: number) => {
    console.log(`🎯 Slot ${slotNumber} clicked`);
    setActiveSlot(slotNumber);
    const selection = slotSelections.find(s => s.slotNumber === slotNumber);
    const slotConfig = cruisingSlots.find(s => s.slotNumber === slotNumber);
    
    console.log('🎯 Slot click details:', {
      slotNumber,
      selection,
      slotConfig,
      cameraAngle: slotConfig?.cameraAngle,
      sceneVideos
    });
    
    if (videoRef.current && selection && slotConfig) {
      // Load the appropriate camera video, fallback to camera 1 if camera 2 not available
      let videoUrl = slotConfig.cameraAngle === 1 ? sceneVideos.camera1 : sceneVideos.camera2;
      
      // Fallback: if requested camera not available, use camera 1
      if (!videoUrl && slotConfig.cameraAngle === 2 && sceneVideos.camera1) {
        videoUrl = sceneVideos.camera1;
        console.log(`🔄 Camera 2 not available for slot ${slotConfig.slotNumber}, using Camera 1 as fallback`);
      }
      
      console.log(`🎯 Loading video for camera ${slotConfig.cameraAngle}:`, videoUrl ? videoUrl.substring(0, 50) + '...' : 'No URL');
      
      if (videoUrl) {
        try {
          console.log(`🎯 Setting video source to:`, videoUrl.substring(0, 50) + '...');
          
          videoRef.current.src = videoUrl;
          videoRef.current.currentTime = selection.windowStart;
          
          // Wait for video to load before playing
          videoRef.current.addEventListener('loadeddata', () => {
            console.log('✅ Video loaded successfully, starting playback at', selection.windowStart);
            if (videoRef.current) {
              videoRef.current.currentTime = selection.windowStart;
              videoRef.current.play().catch(error => {
                console.error('❌ Error playing video:', error);
              });
            }
          }, { once: true });
          
          // More detailed error handling
          videoRef.current.addEventListener('error', (event) => {
            const video = event.target as HTMLVideoElement;
            console.error('❌ Video load error details:', {
              error: video.error,
              errorCode: video.error?.code,
              errorMessage: video.error?.message,
              networkState: video.networkState,
              readyState: video.readyState,
              src: video.src.substring(0, 50) + '...',
              srcLength: video.src.length,
              canPlayType: {
                mp4: video.canPlayType('video/mp4'),
                mp4_h264: video.canPlayType('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'),
                webm: video.canPlayType('video/webm'),
                'webm-vp8': video.canPlayType('video/webm; codecs="vp8"')
              }
            });
            
            // If video fails, try to clear the blob URL and regenerate
            if (video.error?.code === 4) { // MEDIA_ELEMENT_ERROR: Format error
              console.log('🔄 Attempting to reload video with different format...');
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }, 500);
            }
          }, { once: true });
          
          // Debug what happens during loading
          videoRef.current.addEventListener('loadstart', () => {
            console.log('📡 Video loading started');
          }, { once: true });
          
          videoRef.current.addEventListener('progress', () => {
            console.log('📊 Video loading progress');
          }, { once: true });
          
          // Load the video
          videoRef.current.load();
        } catch (error) {
          console.error('❌ Error setting up video:', error);
        }
      } else {
        console.warn(`⚠️ No video available for camera ${slotConfig.cameraAngle} in cruising scene`);
      }
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
                Customers: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
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
              <div className="relative aspect-video bg-gradient-to-br from-gray-950 to-gray-900 rounded-lg overflow-hidden border-2 border-orange-500/50">
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
                      sceneDuration={sceneVideos.duration || 60}
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
