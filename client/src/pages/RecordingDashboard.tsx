import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PhaseNavigation from "@/components/PhaseNavigation";
import { usePilot } from "@/contexts/PilotContext";
import { useToast } from "@/hooks/use-toast";
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

  const currentScene = SCENES[currentSceneIndex];

  // Initialize cameras
  useEffect(() => {
    initializeCameras();
    return () => {
      stopCameras();
    };
  }, []);

  const initializeCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      // Camera 1
      const stream1 = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoDevices[0]?.deviceId }
      });
      setCamera1Stream(stream1);
      if (video1Ref.current) {
        video1Ref.current.srcObject = stream1;
        video1Ref.current.play();
      }

      // Camera 2
      if (videoDevices.length >= 2) {
        const stream2 = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: videoDevices[1]?.deviceId }
        });
        setCamera2Stream(stream2);
        if (video2Ref.current) {
          video2Ref.current.srcObject = stream2;
          video2Ref.current.play();
        }
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
      }
    }
  }, [recordingState, countdown]);

  const handleStartRecording = () => {
    setRecordingState("countdown");
    setElapsedTime(0);
  };

  const handleStopRecording = () => {
    // Check minimum duration
    if (elapsedTime < 30) {
      toast({
        title: "Recording Too Short",
        description: "Please record at least 30 seconds for each scene.",
        variant: "destructive",
      });
      return;
    }
    
    setRecordingState("completed");
    
    // Mark scene as completed
    setSceneRecordings(prev => prev.map((rec, idx) => 
      idx === currentSceneIndex 
        ? { ...rec, camera1Duration: elapsedTime, camera2Duration: elapsedTime, completed: true }
        : rec
    ));
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
  };

  const handleRetake = () => {
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
              <h1 className="text-3xl font-bold text-foreground">Flight Recording</h1>
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
                    <div className={`flex items-center gap-1 text-sm ${elapsedTime >= 30 ? "text-green-500" : "text-yellow-500"}`}>
                      <Target className="w-4 h-4" />
                      <span>Min: 30s</span>
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
