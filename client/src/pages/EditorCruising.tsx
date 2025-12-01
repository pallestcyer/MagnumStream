import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhaseNavigation from "@/components/PhaseNavigation";
import UnifiedTimeline from "@/components/UnifiedTimeline";
import { SLOT_TEMPLATE, SEAMLESS_PAIRS } from "@shared/schema";
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
  const templateVideoRef = useRef<HTMLVideoElement>(null);
  
  const [slotSelections, setSlotSelections] = useState<SlotSelection[]>(
    SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising').map(slot => ({
      slotNumber: slot.slotNumber,
      windowStart: -1, // -1 indicates "not yet positioned" - will be spread when duration is known
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

          // Spread markers evenly across the actual scene duration if not yet positioned
          // OR clamp existing positions that exceed the actual duration
          const actualDuration = videos.duration || 60;
          setSlotSelections(prev => {
            const needsSpread = prev.some(s => s.windowStart < 0);

            // Also check if any positions exceed the actual duration and need clamping
            const slots = SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising');
            const needsClamp = prev.some(s => {
              const slotConfig = slots.find(slot => slot.slotNumber === s.slotNumber);
              const maxStart = slotConfig ? actualDuration - slotConfig.duration : actualDuration;
              return s.windowStart >= 0 && s.windowStart > maxStart;
            });

            // If only needs clamping (not spreading), clamp positions to valid range
            if (!needsSpread && needsClamp) {
              console.log('🔒 Clamping slot positions to actual duration:', actualDuration);
              return prev.map(selection => {
                const slotConfig = slots.find(slot => slot.slotNumber === selection.slotNumber);
                const maxStart = slotConfig ? Math.max(0, actualDuration - slotConfig.duration) : actualDuration;
                const clampedStart = Math.max(0, Math.min(maxStart, selection.windowStart));
                if (clampedStart !== selection.windowStart) {
                  console.log(`🔒 Clamped slot ${selection.slotNumber} from ${selection.windowStart}s to ${clampedStart}s`);
                }
                return { ...selection, windowStart: clampedStart };
              });
            }
            if (needsSpread) {
              const slots = SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising');

              // Create a map for tracking positions by slot number
              const positionMap = new Map<number, number>();

              // First pass: identify lead/independent slots and calculate their positions
              const leadAndIndependentSlots = slots.filter(s =>
                !SEAMLESS_PAIRS.some(p => p.follow === s.slotNumber)
              );

              // Calculate total duration needed for all slots (including seamless pairs)
              let totalSlotDuration = 0;
              slots.forEach(slot => {
                totalSlotDuration += slot.duration;
              });

              // Use available time leaving some buffer at the end
              const usableTime = Math.max(actualDuration - 5, actualDuration * 0.9);
              const availableGapTime = usableTime - totalSlotDuration;
              const gapBetweenGroups = Math.max(0, availableGapTime / Math.max(1, leadAndIndependentSlots.length));

              // Position lead and independent slots first
              let currentPosition = 0;
              leadAndIndependentSlots.forEach((slotConfig) => {
                positionMap.set(slotConfig.slotNumber, currentPosition);

                // Check if this slot has a follow slot in a seamless pair
                const seamlessPair = SEAMLESS_PAIRS.find(p => p.lead === slotConfig.slotNumber);
                if (seamlessPair) {
                  // Position the follow slot right after the lead
                  const followPosition = currentPosition + slotConfig.duration;
                  positionMap.set(seamlessPair.follow, followPosition);

                  // Find follow slot duration
                  const followSlot = slots.find(s => s.slotNumber === seamlessPair.follow);
                  currentPosition = followPosition + (followSlot?.duration || 3) + gapBetweenGroups;
                } else {
                  currentPosition += slotConfig.duration + gapBetweenGroups;
                }
              });

              // Now update the selections with the calculated positions
              return prev.map(selection => ({
                ...selection,
                windowStart: positionMap.get(selection.slotNumber) ?? 0
              }));
            }
            return prev;
          });
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

    // Load template video for this slot
    if (templateVideoRef.current) {
      const slotIndex = cruisingSlots.findIndex(s => s.slotNumber === slotNumber);
      const templatePath = `/templates/CRUISE_${slotIndex + 1}.mov`;
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

      console.log(`🎯 Loading video for camera ${slotConfig.cameraAngle}:`, videoUrl ? videoUrl.substring(0, 50) + '...' : 'No URL');

      if (videoUrl) {
        try {
          const video = videoRef.current;
          const currentSrc = video.src;
          const needsSourceChange = !currentSrc || !currentSrc.startsWith('blob:') || currentSrc !== videoUrl;

          // Calculate safe window start (clamped to video duration)
          const videoDuration = video.duration || sceneVideos.duration || 60;
          const slotDuration = slotConfig.duration || 3;
          const safeWindowStart = Math.max(0, Math.min(selection.windowStart, videoDuration - slotDuration));

          console.log(`🎯 Safe window start: ${safeWindowStart} (original: ${selection.windowStart}, video duration: ${videoDuration})`);

          const seekAndPlay = () => {
            if (videoRef.current) {
              const v = videoRef.current;
              const actualDuration = v.duration || videoDuration;
              const clampedStart = Math.max(0, Math.min(safeWindowStart, actualDuration - slotDuration));

              console.log(`🎯 Seeking to ${clampedStart}s (video duration: ${actualDuration})`);
              v.currentTime = clampedStart;
              v.play().catch(error => {
                console.error('❌ Error playing video:', error);
              });
            }
          };

          if (needsSourceChange) {
            console.log(`🎯 Changing video source to:`, videoUrl.substring(0, 50) + '...');
            video.src = videoUrl;

            // Wait for video to be ready before seeking
            video.addEventListener('canplay', () => {
              console.log('✅ Video ready to play');
              seekAndPlay();
            }, { once: true });

            video.addEventListener('error', (event) => {
              const v = event.target as HTMLVideoElement;
              console.error('❌ Video load error:', v.error?.message || 'Unknown error');
            }, { once: true });

            video.load();
          } else {
            // Same source, just seek to new position
            console.log(`🎯 Same source, just seeking to ${safeWindowStart}s`);
            seekAndPlay();
          }
        } catch (error) {
          console.error('❌ Error setting up video:', error);
        }
      } else {
        console.warn(`⚠️ No video available for camera ${slotConfig.cameraAngle} in cruising scene`);
      }
    }
  };

  // Loop video after slot duration (like the template video)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const selection = slotSelections.find(s => s.slotNumber === activeSlot);
      if (selection && selection.windowStart >= 0) {
        // Get the duration for this slot from SLOT_TEMPLATE
        const slotConfig = SLOT_TEMPLATE.find(config => config.slotNumber === selection.slotNumber);
        const slotDuration = slotConfig?.duration || 3;

        // Clamp windowStart to actual video duration
        const videoDuration = video.duration || sceneVideos.duration || 60;
        const safeWindowStart = Math.min(selection.windowStart, Math.max(0, videoDuration - slotDuration));
        const loopEndTime = safeWindowStart + slotDuration;

        if (video.currentTime >= loopEndTime || video.currentTime < safeWindowStart - 0.5) {
          // Loop back to the start of the slot window
          video.currentTime = safeWindowStart;
        }
      }
    };

    // Handle video ending naturally (e.g., if slot window is near end of recording)
    const handleEnded = () => {
      const selection = slotSelections.find(s => s.slotNumber === activeSlot);
      if (selection && selection.windowStart >= 0) {
        const slotConfig = SLOT_TEMPLATE.find(config => config.slotNumber === selection.slotNumber);
        const slotDuration = slotConfig?.duration || 3;
        const videoDuration = video.duration || sceneVideos.duration || 60;
        const safeWindowStart = Math.min(selection.windowStart, Math.max(0, videoDuration - slotDuration));
        video.currentTime = safeWindowStart;
        video.play().catch(e => console.error('Error restarting video:', e));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [activeSlot, slotSelections, sceneVideos.duration]);

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
                    Slot {activeSlot} • Cruising • Camera {cruisingSlots.find(s => s.slotNumber === activeSlot)?.cameraAngle}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Unified Timeline */}
          <UnifiedTimeline
            sceneType="cruising"
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
