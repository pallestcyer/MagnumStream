import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhaseNavigation from "@/components/PhaseNavigation";
import UnifiedTimeline from "@/components/UnifiedTimeline";
import { SLOT_TEMPLATE, SEAMLESS_PAIRS } from "@shared/schema";
import { usePilot } from "@/contexts/PilotContext";
import { ArrowRight, ArrowLeft, Play, Volume2, VolumeX } from "lucide-react";
import { videoStorage } from "@/utils/videoStorage";

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
}

export default function EditorChase() {
  const [, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [sceneVideos, setSceneVideos] = useState<{camera1?: string, camera2?: string, duration?: number}>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const templateVideoRef = useRef<HTMLVideoElement>(null);
  
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.filter(s => s.sceneType === 'chase').map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: -1, // -1 indicates "not yet positioned" - will be spread when duration is known
    }))
  );
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  const chaseSlots = SLOT_TEMPLATE.filter(s => s.sceneType === 'chase');
  
  // Load timeline positions on component mount
  useEffect(() => {
    const loadTimelinePositions = async () => {
      try {
        const recordingId = localStorage.getItem('currentRecordingId');
        if (recordingId) {
          setCurrentRecordingId(recordingId);
          
          // Fetch existing video slots for this recording (chase scene only)
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
            const chaseSlots = existingSlots.filter(s => {
              const slotConfig = SLOT_TEMPLATE.find(t => t.slotNumber === s.slot_number);
              return slotConfig?.sceneType === 'chase';
            });
            
            if (chaseSlots.length > 0) {
              setSlotSelections(prev => 
                prev.map(slot => {
                  const existingSlot = chaseSlots.find(s => s.slot_number === slot.slotNumber);
                  return existingSlot 
                    ? { ...slot, windowStart: existingSlot.window_start }
                    : slot;
                })
              );
              console.log('Loaded timeline positions for chase slots:', chaseSlots);
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
        const duration = localStorage.getItem('scene_chase_duration');
        
        console.log('Loading chase scene videos from IndexedDB...');
        
        // Debug: Check current session
        const currentSessionId = localStorage.getItem('currentSessionId');
        console.log('🔍 Current session ID for chase scene:', currentSessionId);
        
        // Debug: Show all records in IndexedDB
        await videoStorage.debugAllRecords();
        
        // Load videos from IndexedDB
        const camera1Blob = await videoStorage.getVideo('chase', 1);
        const camera2Blob = await videoStorage.getVideo('chase', 2);
        const videoDuration = await videoStorage.getVideoDuration('chase');
        
        console.log('Loaded chase scene videos:', {
          camera1: camera1Blob ? `Available (${camera1Blob.size} bytes)` : 'Missing',
          camera2: camera2Blob ? `Available (${camera2Blob.size} bytes)` : 'Missing',
          duration: videoDuration || (duration ? parseFloat(duration) : 60)
        });
        
        // Convert blobs to object URLs
        const videos: {camera1?: string, camera2?: string, duration?: number} = {
          duration: videoDuration || (duration ? parseFloat(duration) : 60)
        };
        
        if (camera1Blob) {
          console.log('🔍 Chase camera 1 blob details:', {
            size: camera1Blob.size,
            type: camera1Blob.type,
            constructor: camera1Blob.constructor.name
          });
          
          // Test if the blob is valid by trying to read a small portion
          try {
            const testSlice = camera1Blob.slice(0, 100);
            const testUrl = URL.createObjectURL(testSlice);
            console.log('🧪 Test slice URL created:', testUrl);
            URL.revokeObjectURL(testUrl);
          } catch (error) {
            console.error('❌ Blob slice test failed:', error);
          }
          
          videos.camera1 = URL.createObjectURL(camera1Blob);
          console.log('🎬 Created chase camera 1 object URL:', {
            size: camera1Blob.size,
            type: camera1Blob.type,
            url: videos.camera1
          });
        }
        
        if (camera2Blob) {
          videos.camera2 = URL.createObjectURL(camera2Blob);
          console.log('🎬 Created chase camera 2 object URL:', {
            size: camera2Blob.size,
            type: camera2Blob.type,
            url: videos.camera2
          });
        }
        
        if (videos.camera1 || videos.camera2) {
          setSceneVideos(videos);

          // Spread markers evenly across the actual scene duration if not yet positioned
          // Keep seamless pairs connected (follow slot starts where lead slot ends)
          const actualDuration = videos.duration || 60;
          setSlotSelections(prev => {
            const needsSpread = prev.some(s => s.windowStart < 0);
            if (needsSpread) {
              const slots = SLOT_TEMPLATE.filter(s => s.sceneType === 'chase');
              const newSelections = [...prev];

              // Count only lead slots and independent slots for spacing calculation
              const leadAndIndependentSlots = slots.filter(s =>
                !SEAMLESS_PAIRS.some(p => p.follow === s.slotNumber)
              );
              const usableTime = actualDuration * 0.85;
              const spacing = usableTime / leadAndIndependentSlots.length;

              let positionIndex = 0;
              slots.forEach((slotConfig, idx) => {
                const isFollowSlot = SEAMLESS_PAIRS.find(p => p.follow === slotConfig.slotNumber);

                if (isFollowSlot) {
                  // Follow slot: position right after its lead slot
                  const leadSlotIndex = slots.findIndex(s => s.slotNumber === isFollowSlot.lead);
                  const leadSelection = newSelections.find(s => s.slotNumber === isFollowSlot.lead);
                  const leadConfig = slots[leadSlotIndex];
                  if (leadSelection && leadConfig) {
                    newSelections[idx] = {
                      ...newSelections[idx],
                      windowStart: leadSelection.windowStart + leadConfig.duration
                    };
                  }
                } else {
                  // Lead or independent slot: spread evenly
                  const newStart = Math.min(positionIndex * spacing, actualDuration - slotConfig.duration);
                  newSelections[idx] = {
                    ...newSelections[idx],
                    windowStart: Math.max(0, newStart)
                  };
                  positionIndex++;
                }
              });

              return newSelections;
            }
            return prev;
          });
        } else {
          // No videos found for current session, clear any existing videos
          console.log('🔄 No chase videos found for current session, clearing display');
          setSceneVideos({});
        }
      } catch (error) {
        console.error('❌ Failed to load chase videos from IndexedDB:', error);
      }
    };
    
    loadVideos();
    
    // Cleanup blob URLs on unmount
    return () => {
      if (sceneVideos.camera1) {
        URL.revokeObjectURL(sceneVideos.camera1);
      }
      if (sceneVideos.camera2) {
        URL.revokeObjectURL(sceneVideos.camera2);
      }
    };
  }, []);

  const handleWindowStartChange = async (slotNumber: number, newStart: number) => {
    console.log(`🔄 EditorChase: Changing slot ${slotNumber} to ${newStart}s`);
    console.log(`🔄 Current recording ID: ${currentRecordingId}`);

    // Update local state immediately for responsive UI
    setSlotSelections(prev =>
      prev.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, windowStart: newStart }
          : slot
      )
    );

    // Check if this slot is a LEAD in a seamless pair
    const seamlessPair = SEAMLESS_PAIRS.find(p => p.lead === slotNumber);
    if (seamlessPair) {
      const leadSlotConfig = SLOT_TEMPLATE.find(s => s.slotNumber === slotNumber);
      if (leadSlotConfig) {
        // Calculate where the follow slot should start (right after lead slot ends)
        const followWindowStart = newStart + leadSlotConfig.duration;

        console.log(`🔗 Auto-positioning seamless follow slot ${seamlessPair.follow} to ${followWindowStart}s`);

        // Update follow slot in local state
        setSlotSelections(prev =>
          prev.map(slot =>
            slot.slotNumber === seamlessPair.follow
              ? { ...slot, windowStart: followWindowStart }
              : slot
          )
        );

        // Save follow slot to database
        if (currentRecordingId) {
          try {
            await fetch(`/api/recordings/${currentRecordingId}/video-slots/${seamlessPair.follow}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ windowStart: followWindowStart })
            });
            console.log(`✅ Auto-saved seamless follow slot ${seamlessPair.follow}: ${followWindowStart}s`);
          } catch (error) {
            console.error('❌ Error auto-saving follow slot:', error);
          }
        }
      }
    }

    // Update video preview
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
    }

    // Save to database
    if (currentRecordingId) {
      try {
        console.log(`💾 Saving chase slot ${slotNumber} position ${newStart}s to API...`);
        const response = await fetch(`/api/recordings/${currentRecordingId}/video-slots/${slotNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ windowStart: newStart })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Saved chase timeline position for slot ${slotNumber}: ${newStart}s`, result);
        } else {
          console.error('❌ Failed to save chase timeline position:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
        }
      } catch (error) {
        console.error('❌ Error saving chase timeline position:', error);
      }
    } else {
      console.warn('⚠️ No current recording ID - cannot save chase timeline position');
    }
  };

  const handleSlotClick = (slotNumber: number) => {
    setActiveSlot(slotNumber);
    const selection = slotSelections.find(s => s.slotNumber === slotNumber);
    const slotConfig = chaseSlots.find(s => s.slotNumber === slotNumber);

    // Load template video for this slot
    if (templateVideoRef.current) {
      const slotIndex = chaseSlots.findIndex(s => s.slotNumber === slotNumber);
      const templatePath = `/templates/CHASE_${slotIndex + 1}.mov`;
      console.log(`🎬 Loading template video: ${templatePath}`);
      templateVideoRef.current.src = templatePath;
      templateVideoRef.current.load();
      templateVideoRef.current.play().catch(error => {
        console.error('❌ Error playing template video:', error);
      });
    }

    if (videoRef.current && selection && slotConfig) {
      // Load the appropriate camera video, fallback to camera 1 if camera 2 not available
      let videoUrl = slotConfig.cameraAngle === 1 ? sceneVideos.camera1 : sceneVideos.camera2;
      
      // Fallback: if requested camera not available, use camera 1
      if (!videoUrl && slotConfig.cameraAngle === 2 && sceneVideos.camera1) {
        videoUrl = sceneVideos.camera1;
        console.log(`🔄 Camera 2 not available for slot ${slotConfig.slotNumber}, using Camera 1 as fallback`);
      }
      
      console.log(`🎯 Chase: Loading video for camera ${slotConfig.cameraAngle}:`, videoUrl ? videoUrl.substring(0, 50) + '...' : 'No URL');
      
      if (videoUrl) {
        try {
          videoRef.current.src = videoUrl;
          videoRef.current.currentTime = selection.windowStart;
          
          // Wait for video to load before playing
          videoRef.current.addEventListener('loadeddata', () => {
            console.log('✅ Chase video loaded successfully, starting playback at', selection.windowStart);
            if (videoRef.current) {
              videoRef.current.currentTime = selection.windowStart;
              videoRef.current.play().catch(error => {
                console.error('❌ Error playing chase video:', error);
              });
            }
          }, { once: true });
          
          // Add error handling
          videoRef.current.addEventListener('error', (event) => {
            const video = event.target as HTMLVideoElement;
            console.error('❌ Chase video load error:', {
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
        console.warn(`No video available for camera ${slotConfig.cameraAngle} in chase scene`);
      }
    }
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
          // Loop back to the start of the slot window instead of pausing
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
              <h1 className="text-3xl font-bold text-foreground">Chase Scene Editor</h1>
              <p className="text-muted-foreground mt-1">
                Customers: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
                {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/editor/cruising")}
                data-testid="button-back-cruising"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back: Cruising
              </Button>
              <Button
                onClick={() => setLocation("/editor/arrival")}
                className="bg-gradient-purple-blue"
                data-testid="button-next-arrival"
              >
                Next: Arrival Scene
                <ArrowRight className="w-4 h-4 ml-2" />
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
                    Slot {activeSlot} • Camera {chaseSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
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
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-orange-500/50">
                <video
                  ref={templateVideoRef}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  data-testid="video-template-preview"
                />
                {!activeSlot && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 to-gray-900">
                    <p className="text-sm text-muted-foreground">Click a slot to view template</p>
                  </div>
                )}
                {activeSlot && (
                  <div className="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded text-sm text-white">
                    Slot {activeSlot} • Chase • Camera {chaseSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Unified Timeline */}
          <UnifiedTimeline
            sceneType="chase"
            sceneDuration={sceneVideos.duration || 60}
            slotSelections={slotSelections}
            activeSlot={activeSlot}
            onSlotClick={handleSlotClick}
            onWindowStartChange={handleWindowStartChange}
          />
        </div>
      </main>
    </div>
  );
}
