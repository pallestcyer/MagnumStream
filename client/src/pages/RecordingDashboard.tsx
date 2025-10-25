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
  const [sceneRecordings, setSceneRecordings] = useState<SceneRecording[]>(
    SCENES.map(scene => ({
      sceneType: scene.type,
      camera1Duration: 0,
      camera2Duration: 0,
      completed: false,
    }))
  );

  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [camera1Stream, setCamera1Stream] = useState<MediaStream | null>(null);
  const [camera2Stream, setCamera2Stream] = useState<MediaStream | null>(null);
  const [camera1Recorder, setCamera1Recorder] = useState<MediaRecorder | null>(null);
  const [camera2Recorder, setCamera2Recorder] = useState<MediaRecorder | null>(null);
  const [recordersStoppedCount, setRecordersStoppedCount] = useState(0);
  const [recordedChunks1, setRecordedChunks1] = useState<Blob[]>([]);
  const [recordedChunks2, setRecordedChunks2] = useState<Blob[]>([]);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  const currentScene = SCENES[currentSceneIndex];

  // Initialize cameras and setup recording
  useEffect(() => {
    console.log('🚀 RecordingDashboard useEffect triggered');
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
      console.log('🔍 Checking for existing recordings for session:', currentSessionId);
      
      for (const scene of SCENES) {
        const camera1Blob = await videoStorage.getVideo(scene.type, 1);
        const camera2Blob = await videoStorage.getVideo(scene.type, 2);
        const duration = await videoStorage.getVideoDuration(scene.type);
        
        // Only consider it a valid existing recording if we have a duration from current session
        if ((camera1Blob || camera2Blob) && duration !== null) {
          console.log(`✅ Found existing recording for ${scene.type} in current session:`, {
            camera1: camera1Blob ? `${camera1Blob.size} bytes` : 'None',
            camera2: camera2Blob ? `${camera2Blob.size} bytes` : 'None',
            duration: duration
          });
          
          // Mark scene as completed
          setSceneRecordings(prev => {
            const updated = prev.map((rec, idx) => {
              if (SCENES[idx].type === scene.type) {
                return {
                  ...rec,
                  camera1Duration: duration || 0,
                  camera2Duration: duration || 0,
                  completed: true
                };
              }
              return rec;
            });
            
            // Auto-advance to next unrecorded scene after state updates
            setTimeout(() => {
              const firstUnrecordedIndex = updated.findIndex(rec => !rec.completed);
              if (firstUnrecordedIndex !== -1 && firstUnrecordedIndex !== currentSceneIndex) {
                console.log(`🔄 Auto-advancing to next unrecorded scene: ${SCENES[firstUnrecordedIndex].title}`);
                setCurrentSceneIndex(firstUnrecordedIndex);
              }
            }, 100);
            
            return updated;
          });
        } else if (camera1Blob || camera2Blob) {
          console.log(`⚠️ Found videos for ${scene.type} but no duration in current session - these are from a different session`);
        } else {
          console.log(`📭 No recordings found for ${scene.type} in current session`);
        }
      }
    } catch (error) {
      console.error('❌ Error checking existing recordings:', error);
    }
  };

  const initializeCameras = async () => {
    try {
      // Get camera configuration from server
      const cameraConfigResponse = await fetch('/api/camera-config');
      const cameraConfig = await cameraConfigResponse.json();
      
      console.log('🎥 Using camera configuration:', cameraConfig);

      // Camera 1 (Straight View)
      console.log('🎥 Initializing Camera 1 (Straight View)...');
      const stream1 = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: cameraConfig.camera1.deviceId },
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
      
      console.log('✅ Camera 1 stream created with', videoTracks1.length, 'video tracks');
      console.log('📊 Camera 1 track settings:', videoTracks1[0].getSettings());
      
      setCamera1Stream(stream1);
      if (video1Ref.current) {
        video1Ref.current.srcObject = stream1;
        video1Ref.current.play();
      }

      // Setup MediaRecorder for Camera 1
      console.log('🎬 Setting up MediaRecorder for Camera 1...');
      
      // Check supported MIME types - prioritize MP4 for Safari compatibility
      const supportedTypes = ['video/mp4; codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm'];
      const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      console.log('📋 Using MIME type:', mimeType);
      console.log('📋 All supported types:', supportedTypes.filter(type => MediaRecorder.isTypeSupported(type)));
      
      const recorder1 = new MediaRecorder(stream1, { mimeType });
      
      recorder1.ondataavailable = (event) => {
        console.log('📹 Camera 1 data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          setRecordedChunks1(prev => {
            const newChunks = [...prev, event.data];
            console.log('📹 Camera 1 total chunks:', newChunks.length);
            return newChunks;
          });
        }
      };
      
      recorder1.onstart = () => console.log('🎬 Camera 1 recording started');
      recorder1.onstop = () => {
        console.log('🛑 Camera 1 recording stopped');
        setRecordersStoppedCount(prev => {
          const newCount = prev + 1;
          console.log(`📊 Recorders stopped: ${newCount}/2`);
          if (newCount >= 2) {
            console.log('📊 Both recorders stopped, saving videos...');
            setTimeout(() => saveRecordedVideos(), 500);
            return 0; // Reset for next recording
          }
          return newCount;
        });
      };
      
      setCamera1Recorder(recorder1);

      // Camera 2 (Side View)
      console.log('🎥 Initializing Camera 2 (Side View)...');
      console.log('🎥 Camera 2 Device ID:', cameraConfig.camera2.deviceId);
      
      const stream2 = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: cameraConfig.camera2.deviceId },
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
          console.log('✅ Camera 2 stream created with', videoTracks2.length, 'video tracks');
          console.log('📊 Camera 2 track settings:', videoTracks2[0].getSettings());
          
          setCamera2Stream(stream2);
          if (video2Ref.current) {
            video2Ref.current.srcObject = stream2;
            video2Ref.current.play();
          }

          // Setup MediaRecorder for Camera 2
          console.log('🎬 Setting up MediaRecorder for Camera 2...');
          const recorder2 = new MediaRecorder(stream2, { mimeType });
        
        recorder2.ondataavailable = (event) => {
          console.log('📹 Camera 2 data available:', event.data.size, 'bytes');
          if (event.data.size > 0) {
            setRecordedChunks2(prev => {
              const newChunks = [...prev, event.data];
              console.log('📹 Camera 2 total chunks:', newChunks.length);
              return newChunks;
            });
          }
        };
        
        recorder2.onstart = () => console.log('🎬 Camera 2 recording started');
        recorder2.onstop = () => {
          console.log('🛑 Camera 2 recording stopped');
          setRecordersStoppedCount(prev => {
            const newCount = prev + 1;
            console.log(`📊 Recorders stopped: ${newCount}/2`);
            if (newCount >= 2) {
              console.log('📊 Both recorders stopped, saving videos...');
              setTimeout(() => saveRecordedVideos(), 500);
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
        console.log('🎬 Starting recording - Camera states:', {
          camera1State: camera1Recorder?.state,
          camera2State: camera2Recorder?.state
        });
        
        // Reset stop counter for new recording
        setRecordersStoppedCount(0);
        
        if (camera1Recorder && camera1Recorder.state === 'inactive') {
          console.log('🎬 Starting Camera 1 recording');
          setRecordedChunks1([]);
          camera1Recorder.start(1000); // Record in 1-second chunks
        }
        if (camera2Recorder && camera2Recorder.state === 'inactive') {
          console.log('🎬 Starting Camera 2 recording');
          setRecordedChunks2([]);
          camera2Recorder.start(1000);
        }
      }
    }
  }, [recordingState, countdown, camera1Recorder, camera2Recorder]);

  const handleStartRecording = async () => {
    setRecordingState("countdown");
    setElapsedTime(0);
    
    // Create a recording session
    if (!currentRecordingId) {
      const recordingId = crypto.randomUUID();
      setCurrentRecordingId(recordingId);
      
      // Create flight recording in database
      try {
        await fetch('/api/recordings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: `${pilotInfo.name || 'Unknown'} Flight`,
            pilotName: pilotInfo.name || 'Unknown Pilot',
            pilotEmail: pilotInfo.email || '',
            staffMember: pilotInfo.staffMember || 'Unknown',
            flightDate: new Date().toISOString().split('T')[0],
            flightTime: new Date().toTimeString().split(' ')[0],
            exportStatus: 'recording'
          })
        });
      } catch (error) {
        console.error('Failed to create recording session:', error);
      }
    }
  };

  const handleStopRecording = async () => {
    // Check minimum duration
    if (elapsedTime < 5) {
      toast({
        title: "Recording Too Short",
        description: "Please record at least 5 seconds for each scene.",
        variant: "destructive",
      });
      return;
    }
    
    // Stop recording
    if (camera1Recorder && camera1Recorder.state === 'recording') {
      camera1Recorder.stop();
    }
    if (camera2Recorder && camera2Recorder.state === 'recording') {
      camera2Recorder.stop();
    }
    
    setRecordingState("completed");
    
    // Mark scene as completed and save video files
    setSceneRecordings(prev => prev.map((rec, idx) => 
      idx === currentSceneIndex 
        ? { ...rec, camera1Duration: elapsedTime, camera2Duration: elapsedTime, completed: true }
        : rec
    ));
    
    // Videos will be saved automatically when both recorders stop (via onstop events)
  };
  
  const saveRecordedVideos = async () => {
    if (!currentRecordingId) return;
    
    try {
      const currentSceneType = currentScene.type;
      
      console.log(`💾 Saving recorded videos for ${currentSceneType}:`, {
        camera1Chunks: recordedChunks1.length,
        camera2Chunks: recordedChunks2.length,
        camera1Size: recordedChunks1.reduce((total, chunk) => total + chunk.size, 0),
        camera2Size: recordedChunks2.reduce((total, chunk) => total + chunk.size, 0),
        elapsedTime
      });
      
      // Only create blobs if we have recorded data
      if (recordedChunks1.length === 0 && recordedChunks2.length === 0) {
        console.warn('⚠️ No recorded chunks found for any camera');
        return;
      }
      
      // Create blobs from recorded chunks with explicit MIME type - prioritize MP4
      const supportedTypes = ['video/mp4; codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm'];
      const recordingMimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      
      const camera1Blob = recordedChunks1.length > 0 ? new Blob(recordedChunks1, { type: recordingMimeType }) : null;
      const camera2Blob = recordedChunks2.length > 0 ? new Blob(recordedChunks2, { type: recordingMimeType }) : null;
      
      console.log('📦 Created blobs:', {
        camera1Size: camera1Blob?.size || 0,
        camera2Size: camera2Blob?.size || 0,
        recordingMimeType,
        camera1Type: camera1Blob?.type,
        camera2Type: camera2Blob?.type
      });
      
      // Store blobs in IndexedDB
      if (camera1Blob) {
        await videoStorage.storeVideo(currentSceneType, 1, camera1Blob, elapsedTime);
        console.log('💾 Stored camera 1 in IndexedDB');
      }
      
      if (camera2Blob) {
        await videoStorage.storeVideo(currentSceneType, 2, camera2Blob, elapsedTime);
        console.log('💾 Stored camera 2 in IndexedDB');
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
        console.log('🎯 All scenes recorded - project marked as recorded');
      }
      
      // Store metadata in localStorage (small data)
      localStorage.setItem(`scene_${currentSceneType}_duration`, elapsedTime.toString());
      localStorage.setItem('currentRecordingId', currentRecordingId);
      
      console.log(`📹 Saved ${currentSceneType} scene videos:`, {
        camera1: camera1Blob ? 'Stored in IndexedDB' : 'No data',
        camera2: camera2Blob ? 'Stored in IndexedDB' : 'No data',
        duration: elapsedTime
      });
      
      toast({
        title: "Scene Recorded",
        description: `${currentSceneType} scene saved successfully`,
      });
      
    } catch (error) {
      console.error('Failed to save recorded videos:', error);
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
      console.log(`🗑️ Cleared existing recording for ${currentSceneType}`);
    } catch (error) {
      console.error('❌ Error clearing scene:', error);
    }
    
    setRecordingState("idle");
    setElapsedTime(0);
    setSceneRecordings(prev => prev.map((rec, idx) => 
      idx === currentSceneIndex 
        ? { ...rec, camera1Duration: 0, camera2Duration: 0, completed: false }
        : rec
    ));
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Video Recording</h1>
              <p className="text-muted-foreground mt-1">
                Customers: <span className="font-semibold text-foreground">{pilotInfo.name || "Not set"}</span>
                {pilotInfo.email && <span className="ml-4 text-sm">({pilotInfo.email})</span>}
              </p>
            </div>
            <Button
              onClick={() => setLocation("/editor/cruising")}
              variant="outline"
              data-testid="button-skip-to-editor"
            >
              Skip to Editing
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
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
                  <span className="text-sm font-medium text-foreground">Camera 1 (Main)</span>
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
                  <span className="text-sm font-medium text-foreground">Camera 2 (Side)</span>
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
                    <div className={`flex items-center gap-1 text-sm ${elapsedTime >= 5 ? "text-green-500" : "text-yellow-500"}`}>
                      <Target className="w-4 h-4" />
                      <span>Min: 5s</span>
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
                  <Button
                    size="lg"
                    onClick={handleStartRecording}
                    className="bg-gradient-purple-blue min-w-40"
                    data-testid="button-start-recording"
                  >
                    <Circle className="w-5 h-5 mr-2 fill-current" />
                    Start Recording
                  </Button>
                  {currentSceneCompleted && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleRetake}
                      data-testid="button-retake"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Retake
                    </Button>
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
                <Button
                  size="lg"
                  onClick={handleNextScene}
                  className="bg-gradient-purple-blue min-w-40"
                  data-testid="button-next-scene"
                >
                  {currentSceneIndex < SCENES.length - 1 ? (
                    <>
                      Next Scene
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    <>
                      Go to Editing
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
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
