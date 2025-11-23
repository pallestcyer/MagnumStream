import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PhaseNavigation from "@/components/PhaseNavigation";
import { usePilot } from "@/contexts/PilotContext";
import { useToast } from "@/hooks/use-toast";
import { videoStorage } from "@/utils/videoStorage";
import { 
  Video, 
  Circle, 
  Square, 
  Pause, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  Target
} from "lucide-react";

type RecordingState = "idle" | "countdown" | "recording" | "paused" | "completed";
type SceneType = "cruising" | "chase" | "arrival";

interface SceneRecording {
  sceneType: SceneType;
  camera1Duration: number;
  camera2Duration: number;
  completed: boolean;
}

const SCENES: { type: SceneType; title: string; description: string }[] = [
  { type: "cruising", title: "Cruising Scene", description: "Record smooth cruising flight footage" },
  { type: "chase", title: "Chase Scene", description: "Capture dynamic chase camera angles" },
  { type: "arrival", title: "Arrival Scene", description: "Record the arrival and landing" },
];

export default function RecordingDashboard() {
  const [, setLocation] = useLocation();
  const { pilotInfo } = usePilot();
  const { toast } = useToast();
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [sceneRecordings, setSceneRecordings] = useState<SceneRecording[]>(() => {
    const initialRecordings = SCENES.map(scene => ({
      sceneType: scene.type,
      camera1Duration: 0,
      camera2Duration: 0,
      completed: false,
    }));
    return initialRecordings;
  });

  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [camera1Stream, setCamera1Stream] = useState<MediaStream | null>(null);
  const [camera2Stream, setCamera2Stream] = useState<MediaStream | null>(null);
  const [camera1Recorder, setCamera1Recorder] = useState<MediaRecorder | null>(null);
  const [camera2Recorder, setCamera2Recorder] = useState<MediaRecorder | null>(null);
  const [recordersStoppedCount, setRecordersStoppedCount] = useState(0);
  const [recordedChunks1, setRecordedChunks1] = useState<Blob[]>([]);
  const [recordedChunks2, setRecordedChunks2] = useState<Blob[]>([]);
  const chunksRef1 = useRef<Blob[]>([]);
  const chunksRef2 = useRef<Blob[]>([]);
  const elapsedTimeRef = useRef<number>(0);
  const recordingSceneRef = useRef<SceneType>('cruising'); // Track which scene is being recorded
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(
    () => localStorage.getItem('currentRecordingId')
  );

  const currentScene = SCENES[currentSceneIndex];

  // Keep elapsedTimeRef in sync with elapsedTime
  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  // Initialize cameras and setup recording
  useEffect(() => {
    initializeCameras().catch(error => {
      console.error('❌ Failed to initialize cameras:', error);
    });
    checkExistingRecordings();
    return () => {
      stopCameras();
    };
  }, []);

  // Check for existing recordings on load
  const checkExistingRecordings = async () => {
    try {
      const currentSessionId = localStorage.getItem('currentSessionId');

      for (const scene of SCENES) {
        const camera1Blob = await videoStorage.getVideo(scene.type, 1);
        const camera2Blob = await videoStorage.getVideo(scene.type, 2);
        const duration = await videoStorage.getVideoDuration(scene.type);

        // Check for persisted completion status
        const sessionId = localStorage.getItem('currentSessionId') || 'default';
        const completionKey = `scene_completed_${sessionId}_${scene.type}`;
        const isCompleted = localStorage.getItem(completionKey) === 'true';

        // Only consider it a valid existing recording if completion status is explicitly true
        // This prevents re-marking scenes as completed after they've been cleared for re-recording
        if (isCompleted && ((camera1Blob || camera2Blob) && duration !== null)) {
          console.log(`✅ Found existing recording for ${scene.type}`);

          // Mark scene as completed and persist the status
          setSceneRecordings(prev => {
            const updated = prev.map((rec, idx) => {
              if (SCENES[idx].type === scene.type) {
                const updatedRec = {
                  ...rec,
                  camera1Duration: duration || 0,
                  camera2Duration: duration || 0,
                  completed: true
                };

                // Persist completion status to localStorage
                const sessionId = localStorage.getItem('currentSessionId') || 'default';
                const completionKey = `scene_completed_${sessionId}_${scene.type}`;
                localStorage.setItem(completionKey, 'true');

                return updatedRec;
              }
              return rec;
            });

            // Auto-advance to next unrecorded scene after state updates
            setTimeout(() => {
              const firstUnrecordedIndex = updated.findIndex(rec => !rec.completed);
              if (firstUnrecordedIndex !== -1 && firstUnrecordedIndex !== currentSceneIndex) {
                setCurrentSceneIndex(firstUnrecordedIndex);
              }
            }, 100);

            return updated;
          });
        }
      }
    } catch (error) {
      console.error('❌ Error checking existing recordings:', error);
    }
  };

  const initializeCameras = async () => {
    try {
      // Get camera configuration from server
      let cameraConfig: any = {
        camera1: { deviceId: 'default', label: 'Camera 1 (Side View)' },
        camera2: { deviceId: 'default', label: 'Camera 2 (Front View)' }
      };

      try {
        const cameraConfigResponse = await fetch('/api/camera-config');
        if (cameraConfigResponse.ok) {
          const config = await cameraConfigResponse.json();
          // Check if we got a valid config (not an error)
          if (config.camera1 && config.camera2) {
            cameraConfig = config;
            console.log('🎥 Camera configuration loaded from server');
          } else {
            console.warn('⚠️ Invalid camera config response, using defaults');
          }
        } else {
          console.warn('⚠️ Camera config API failed, using default cameras');
        }
      } catch (configError) {
        console.warn('⚠️ Camera config API unavailable, using default cameras');
      }

      // Camera 1 (Side View)
      const stream1 = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameraConfig.camera1.deviceId === 'default' ? undefined : { exact: cameraConfig.camera1.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      // Validate video tracks
      const videoTracks1 = stream1.getVideoTracks();
      if (videoTracks1.length === 0) {
        console.error('❌ No video tracks in camera 1 stream');
        return;
      }

      console.log('✅ Camera 1 initialized');
      
      setCamera1Stream(stream1);
      if (video1Ref.current) {
        video1Ref.current.srcObject = stream1;
        video1Ref.current.play();
      }

      // Setup MediaRecorder for Camera 1
      // Check supported MIME types - prioritize MP4 for Safari compatibility
      const supportedTypes = ['video/mp4; codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm'];
      const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const recorder1 = new MediaRecorder(stream1, { mimeType });

      recorder1.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Store in both ref (immediate) and state (for UI)
          chunksRef1.current = [...chunksRef1.current, event.data];
          setRecordedChunks1(prev => [...prev, event.data]);
        }
      };

      recorder1.onstart = () => console.log('🎬 Camera 1 recording started');
      recorder1.onstop = () => {
        console.log('🛑 Camera 1 recording stopped');
        setRecordersStoppedCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 2) {
            console.log('✅ Both recorders stopped, saving videos');
            // Capture the current elapsed time from ref (not closure)
            const capturedElapsedTime = elapsedTimeRef.current;
            // Save with a delay to ensure all ondataavailable events have fired
            setTimeout(() => {
              saveRecordedVideos(capturedElapsedTime);
            }, 500); // Reduced delay but still enough for final chunks
            return 0; // Reset for next recording
          }
          return newCount;
        });
      };
      
      setCamera1Recorder(recorder1);

      // Camera 2 (Side View)
      const stream2 = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameraConfig.camera2.deviceId === 'default' ? undefined : { exact: cameraConfig.camera2.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

        // Validate video tracks
        const videoTracks2 = stream2.getVideoTracks();
        if (videoTracks2.length === 0) {
          console.error('❌ No video tracks in camera 2 stream');
        } else {
          console.log('✅ Camera 2 initialized');
          
          setCamera2Stream(stream2);
          if (video2Ref.current) {
            video2Ref.current.srcObject = stream2;
            video2Ref.current.play();
          }

          // Setup MediaRecorder for Camera 2
          const recorder2 = new MediaRecorder(stream2, { mimeType });

        recorder2.ondataavailable = (event) => {
          if (event.data.size > 0) {
            // Store in both ref (immediate) and state (for UI)
            chunksRef2.current = [...chunksRef2.current, event.data];
            setRecordedChunks2(prev => [...prev, event.data]);
          }
        };

        recorder2.onstart = () => console.log('🎬 Camera 2 recording started');
        recorder2.onstop = () => {
          console.log('🛑 Camera 2 recording stopped');
          setRecordersStoppedCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 2) {
              console.log('✅ Both recorders stopped, saving videos');
              // Capture the current elapsed time from ref (not closure)
              const capturedElapsedTime = elapsedTimeRef.current;
              // Save with a delay to ensure all ondataavailable events have fired
              setTimeout(() => {
                saveRecordedVideos(capturedElapsedTime);
              }, 500); // Reduced delay but still enough for final chunks
              return 0; // Reset for next recording
            }
            return newCount;
          });
        };
        
        setCamera2Recorder(recorder2);
        }
    } catch (error) {
      console.error("Camera access error:", error);
    }
  };

  const stopCameras = () => {
    camera1Stream?.getTracks().forEach(track => track.stop());
    camera2Stream?.getTracks().forEach(track => track.stop());
  };

  // Timer management
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  // Countdown management
  useEffect(() => {
    if (recordingState === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setRecordingState("recording");
        setCountdown(3);

        // Start actual recording
        // Capture the scene being recorded
        recordingSceneRef.current = currentScene.type;
        console.log(`🎬 Recording ${recordingSceneRef.current} scene`);

        // Reset stop counter for new recording
        setRecordersStoppedCount(0);

        if (camera1Recorder && camera1Recorder.state === 'inactive') {
          setRecordedChunks1([]);
          chunksRef1.current = []; // Clear ref
          camera1Recorder.start(100); // Record in smaller chunks to ensure data collection
        }
        if (camera2Recorder && camera2Recorder.state === 'inactive') {
          setRecordedChunks2([]);
          chunksRef2.current = []; // Clear ref
          camera2Recorder.start(100); // Record in smaller chunks to ensure data collection
        }
      }
    }
  }, [recordingState, countdown, camera1Recorder, camera2Recorder]);

  const handleStartRecording = async () => {
    setRecordingState("countdown");
    setElapsedTime(0);

    // Check for existing recording ID (from ProjectsPage or localStorage)
    const existingRecordingId = currentRecordingId || localStorage.getItem('currentRecordingId');

    if (existingRecordingId) {
      // Use existing recording - just update status to 'recording'
      console.log('📋 Using existing recording:', existingRecordingId);
      setCurrentRecordingId(existingRecordingId);

      // Update the existing recording's status to 'recording'
      try {
        await fetch(`/api/recordings/${existingRecordingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exportStatus: 'recording' })
        });
        console.log('✅ Updated recording status to recording');
      } catch (error) {
        console.error('Failed to update recording status:', error);
      }
    } else {
      // No existing recording - create a new one (fallback for direct access)
      console.log('⚠️ No existing recording ID found, creating new recording');
      try {
        const response = await fetch('/api/recordings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: `${pilotInfo.name || 'Unknown'} Flight`,
            pilotName: pilotInfo.name || 'Unknown Pilot',
            pilotEmail: pilotInfo.email || '',
            staffMember: pilotInfo.staffMember || 'Unknown',
            flightDate: new Date().toISOString().split('T')[0],
            flightTime: new Date().toTimeString().split(' ')[0],
            exportStatus: 'recording',
            sessionId: pilotInfo.name || 'Unknown'
          })
        });

        if (response.ok) {
          const recording = await response.json();
          const recordingId = recording.id;
          setCurrentRecordingId(recordingId);
          localStorage.setItem('currentRecordingId', recordingId);
          console.log('✅ Created recording in Supabase:', recordingId);
        } else {
          console.error('Failed to create recording:', await response.text());
        }
      } catch (error) {
        console.error('Failed to create recording session:', error);
      }
    }
  };

  const handleStopRecording = async () => {
    // Check minimum duration
    if (elapsedTime < 10) {
      toast({
        title: "Recording Too Short",
        description: "Please record at least 10 seconds for each scene.",
        variant: "destructive",
      });
      return;
    }

    console.log('🛑 Stopping recording');

    // Stop recording
    if (camera1Recorder && camera1Recorder.state === 'recording') {
      camera1Recorder.stop();
    } else {
      console.warn('⚠️ Camera 1 recorder not in recording state');
    }

    if (camera2Recorder && camera2Recorder.state === 'recording') {
      camera2Recorder.stop();
    } else {
      console.warn('⚠️ Camera 2 recorder not in recording state');
    }

    setRecordingState("completed");
  };
  
  const saveRecordedVideos = async (recordingDuration?: number) => {
    // Use existing recording ID - check state first, then localStorage fallback
    let recordingId = currentRecordingId || localStorage.getItem('currentRecordingId');
    if (!recordingId) {
      console.error('❌ No recording ID found');
      toast({
        title: "Recording Error",
        description: "Failed to save recording - no recording ID found.",
        variant: "destructive",
      });
      return;
    }

    // Update state if we got it from localStorage
    if (!currentRecordingId && recordingId) {
      setCurrentRecordingId(recordingId);
    }

    try {
      // Use the captured scene type from when recording started
      const currentSceneType = recordingSceneRef.current;
      // Use the passed duration or fall back to current elapsedTime
      const actualDuration = recordingDuration ?? elapsedTime;

      console.log(`📹 Saving ${currentSceneType} scene (${actualDuration}s)`);
      
      // Use refs for immediate access to chunks
      const chunks1 = chunksRef1.current;
      const chunks2 = chunksRef2.current;

      // Check if we have any chunks at all
      if (chunks1.length === 0 && chunks2.length === 0) {
        console.error(`⚠️ No recorded chunks found for ${currentSceneType} scene`);
        console.warn('Proceeding with completion');
        // Continue execution - don't return early
      }
      
      // Create blobs from recorded chunks with explicit MIME type - prioritize MP4
      const supportedTypes = ['video/mp4; codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm'];
      const recordingMimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      
      const camera1Blob = chunks1.length > 0 ? new Blob(chunks1, { type: recordingMimeType }) : null;
      const camera2Blob = chunks2.length > 0 ? new Blob(chunks2, { type: recordingMimeType }) : null;

      let videosStored = false;
      
      // Store videos sequentially to avoid IndexedDB transaction conflicts
      if (camera1Blob) {
        try {
          await videoStorage.storeVideo(currentSceneType, 1, camera1Blob, actualDuration);
          console.log(`✅ Stored camera 1 video (${actualDuration}s)`);
          videosStored = true;

          // Small delay to ensure transaction completes before next one
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`❌ Failed to store camera 1:`, error);
          // Don't throw - continue with completion even if storage fails
        }
      }

      if (camera2Blob) {
        try {
          await videoStorage.storeVideo(currentSceneType, 2, camera2Blob, actualDuration);
          console.log(`✅ Stored camera 2 video (${actualDuration}s)`);
          videosStored = true;
        } catch (error) {
          console.error(`❌ Failed to store camera 2:`, error);
        }
      }
      
      // Check if all scenes are now recorded for this session
      const currentSessionId = videoStorage.getCurrentSessionId();
      let allScenesRecorded = true;
      
      for (const scene of SCENES) {
        const camera1 = await videoStorage.getVideo(scene.type, 1);
        const camera2 = await videoStorage.getVideo(scene.type, 2);
        if (!camera1 && !camera2) {
          allScenesRecorded = false;
          break;
        }
      }
      
      if (allScenesRecorded) {
        await videoStorage.updateProjectStatus('recorded');
        console.log('✅ All scenes recorded');
      }

      // Store metadata in localStorage (small data)
      localStorage.setItem(`scene_${currentSceneType}_duration`, actualDuration.toString());
      localStorage.setItem('currentRecordingId', recordingId);

      // Find the correct scene index by scene type (not current scene index which may have changed)
      const sceneIndex = SCENES.findIndex(scene => scene.type === currentSceneType);

      if (sceneIndex === -1) {
        console.error(`❌ Could not find scene index for ${currentSceneType}`);
        return;
      }

      // Only mark scene as completed AFTER successful video saving
      setSceneRecordings(prev => {
        const updated = prev.map((rec, idx) => {
          if (idx === sceneIndex) {
            const updatedRec = { ...rec, camera1Duration: actualDuration, camera2Duration: actualDuration, completed: true };

            // Persist completion status to localStorage
            const sessionId = localStorage.getItem('currentSessionId') || 'default';
            const completionKey = `scene_completed_${sessionId}_${currentSceneType}`;
            localStorage.setItem(completionKey, 'true');
            console.log(`✅ Scene ${currentSceneType} completed (${actualDuration}s)`);

            return updatedRec;
          }
          return rec;
        });

        // Auto-advance to next unrecorded scene after recording completion
        setTimeout(() => {
          const firstUnrecordedIndex = updated.findIndex(rec => !rec.completed);
          if (firstUnrecordedIndex !== -1) {
            setCurrentSceneIndex(firstUnrecordedIndex);
            setRecordingState("idle");
            setElapsedTime(0);
          } else {
            console.log('🎉 All scenes completed');
            setRecordingState("idle");
          }
        }, 100);

        return updated;
      });

    } catch (error) {
      console.error('❌ Failed to save recorded videos:', error);
      
      toast({
        title: "Save Failed",
        description: "Could not save recorded videos",
        variant: "destructive",
      });
    }
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
  };

  const handleRetake = async () => {
    const currentSceneType = currentScene.type;

    // Clear the scene from IndexedDB
    try {
      await videoStorage.clearScene(currentSceneType);
      console.log(`🗑️ Cleared ${currentSceneType} for re-recording`);
    } catch (error) {
      console.error('❌ Error clearing scene:', error);
    }

    // Clear completion status from localStorage
    const sessionId = localStorage.getItem('currentSessionId') || 'default';
    const completionKey = `scene_completed_${sessionId}_${currentSceneType}`;
    localStorage.removeItem(completionKey);

    // Clear any stored duration metadata
    localStorage.removeItem(`scene_${currentSceneType}_duration`);

    // Force update the scene recording state immediately
    setSceneRecordings(prev => {
      const updated = prev.map((rec, idx) =>
        idx === currentSceneIndex
          ? { ...rec, camera1Duration: 0, camera2Duration: 0, completed: false }
          : rec
      );
      return updated;
    });

    setRecordingState("idle");
    setElapsedTime(0);

    toast({
      title: "Scene Cleared",
      description: `${currentSceneType} scene cleared for re-recording`,
    });
  };

  const handleNextScene = () => {
    if (currentSceneIndex < SCENES.length - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
      setRecordingState("idle");
      setElapsedTime(0);
    } else {
      // All scenes done, go to editor
      setLocation("/editor/cruising");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const allScenesCompleted = sceneRecordings.every(rec => rec.completed);
  const currentSceneCompleted = sceneRecordings[currentSceneIndex].completed;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhaseNavigation currentPhase="recording" completedPhases={["info"]} />

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with Pilot Info */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Video Recording</h1>
            <p className="text-muted-foreground mt-1">
              Customers: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
              {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
            </p>
          </div>

          {/* Scene Progress */}
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Recording Progress</h2>
              <Badge variant="outline" className="px-3 py-1">
                Scene {currentSceneIndex + 1} of {SCENES.length}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {SCENES.map((scene, idx) => {
                const rec = sceneRecordings[idx];
                const isCurrent = idx === currentSceneIndex;
                
                
                return (
                  <button
                    key={scene.type}
                    onClick={() => {
                      if (rec.completed && idx !== currentSceneIndex) {
                        // Switching to a completed scene - show confirmation
                        const confirm = window.confirm(
                          `${scene.title} has already been recorded (${formatTime(rec.camera1Duration)}). Switch to re-record?`
                        );
                        if (!confirm) return;
                      }
                      
                      setCurrentSceneIndex(idx);
                      setRecordingState("idle");
                      setElapsedTime(0);
                    }}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all hover-elevate
                      ${isCurrent ? "border-primary bg-primary/10" : "border-border bg-card/20"}
                    `}
                    data-testid={`scene-button-${scene.type}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">{scene.title}</span>
                      {rec.completed && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{scene.description}</p>
                    {rec.completed && (
                      <div className="mt-2 text-xs text-orange-400">
                        ✅ Recorded ({formatTime(rec.camera1Duration)})
                        <br />
                        <span className="text-muted-foreground">Click to re-record</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Live Camera Feeds */}
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Live Camera Feeds</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Camera 1 (Side)</span>
                  <Video className="w-4 h-4 text-orange-500" />
                </div>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-orange-500/50">
                  <video
                    ref={video1Ref}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                    data-testid="video-camera1-live"
                  />
                  {recordingState === "recording" && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full">
                      <Circle className="w-3 h-3 fill-current animate-pulse" />
                      <span className="text-xs font-bold text-white">REC</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Camera 2 (Front)</span>
                  <Video className="w-4 h-4 text-orange-400" />
                </div>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-orange-400/50">
                  <video
                    ref={video2Ref}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                    data-testid="video-camera2-live"
                  />
                  {recordingState === "recording" && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full">
                      <Circle className="w-3 h-3 fill-current animate-pulse" />
                      <span className="text-xs font-bold text-white">REC</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Recording Controls */}
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {currentScene.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentScene.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold text-foreground">
                  {recordingState === "countdown" ? countdown : formatTime(elapsedTime)}
                </div>
                <div className="flex items-center gap-2 justify-end mt-1">
                  {(recordingState === "recording" || recordingState === "paused") && (
                    <div className={`flex items-center gap-1 text-sm ${elapsedTime >= 10 ? "text-green-500" : "text-yellow-500"}`}>
                      <Target className="w-4 h-4" />
                      <span>Min: 10s</span>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {recordingState === "countdown" ? "Starting..." : recordingState === "recording" ? "Recording..." : recordingState === "paused" ? "Paused" : "Ready"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6">
              {recordingState === "idle" && (
                <>
                  {!currentSceneCompleted ? (
                    <Button
                      size="lg"
                      onClick={handleStartRecording}
                      className="bg-gradient-purple-blue min-w-40"
                      data-testid="button-start-recording"
                    >
                      <Circle className="w-5 h-5 mr-2 fill-current" />
                      Start Recording
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        onClick={handleRetake}
                        variant={allScenesCompleted ? "outline" : undefined}
                        className={allScenesCompleted ? "min-w-40" : "bg-gradient-purple-blue min-w-40"}
                        data-testid="button-retake"
                      >
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Re-record
                      </Button>
                      {allScenesCompleted && (
                        <Button
                          size="lg"
                          onClick={() => setLocation("/editor/cruising")}
                          className="bg-gradient-purple-blue min-w-40"
                          data-testid="button-move-to-editing-idle"
                        >
                          Move to Editing
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}

              {recordingState === "recording" && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handlePauseRecording}
                    data-testid="button-pause-recording"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleStopRecording}
                    className="bg-red-500 hover:bg-red-600"
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}

              {recordingState === "paused" && (
                <>
                  <Button
                    size="lg"
                    onClick={handleResumeRecording}
                    className="bg-gradient-purple-blue"
                    data-testid="button-resume-recording"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleStopRecording}
                    data-testid="button-stop-paused"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}

              {recordingState === "completed" && (
                <>
                  <Button
                    size="lg"
                    onClick={handleRetake}
                    variant={allScenesCompleted ? "outline" : undefined}
                    className={allScenesCompleted ? "min-w-40" : "bg-gradient-purple-blue min-w-40"}
                    data-testid="button-retake-after-completed"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Re-record
                  </Button>
                  {allScenesCompleted && (
                    <Button
                      size="lg"
                      onClick={() => setLocation("/editor/cruising")}
                      className="bg-gradient-purple-blue min-w-40"
                      data-testid="button-move-to-editing"
                    >
                      Move to Editing
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Progress Summary */}
          {allScenesCompleted && (
            <Card className="p-6 bg-green-500/10 border-green-500/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">All Scenes Recorded!</h3>
                    <p className="text-sm text-muted-foreground">You can now proceed to editing your flight video.</p>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={() => setLocation("/editor/cruising")}
                  className="bg-gradient-purple-blue"
                  data-testid="button-proceed-to-editor"
                >
                  Proceed to Editing
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
