import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import NavigationSidebar from "@/components/NavigationSidebar";
import Header from "@/components/Header";
import PhaseIndicator from "@/components/PhaseIndicator";
import RecordingStatus from "@/components/RecordingStatus";
import CameraPreview from "@/components/CameraPreview";
import RecordingControls from "@/components/RecordingControls";
import IntroductionForm from "@/components/IntroductionForm";
import Timeline from "@/components/Timeline";
import CountdownOverlay from "@/components/CountdownOverlay";
import StorageIndicator from "@/components/StorageIndicator";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

type RecordingState = "idle" | "countdown" | "recording" | "paused" | "stopped";
type Phase = 1 | 2 | 3;

interface Clip {
  id: string;
  title: string;
  duration: number;
  phaseId: number;
}

export default function RecordingDashboard() {
  const [, setLocation] = useLocation();
  const [currentPhase, setCurrentPhase] = useState<Phase>(1);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeNav, setActiveNav] = useState("recording");

  const phases = [
    { id: 1, title: "Introduction", completed: clips.some(c => c.phaseId === 1) },
    { id: 2, title: "Main Tour", completed: clips.some(c => c.phaseId === 2) },
    { id: 3, title: "Closing", completed: clips.some(c => c.phaseId === 3) },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  const handleStartRecording = () => {
    if (currentPhase === 1 && !name.trim()) {
      alert("Please enter your name before recording");
      return;
    }
    setRecordingState("countdown");
  };

  const handleCountdownComplete = () => {
    setRecordingState("recording");
    setElapsedTime(0);
  };

  const handleStopRecording = () => {
    setRecordingState("stopped");
    
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      title: `Phase ${currentPhase}: ${phases[currentPhase - 1].title}`,
      duration: elapsedTime,
      phaseId: currentPhase,
    };
    
    setClips([...clips, newClip]);
    
    if (currentPhase < 3) {
      setTimeout(() => {
        setCurrentPhase((prev) => (prev + 1) as Phase);
        setRecordingState("idle");
        setElapsedTime(0);
      }, 1000);
    } else {
      setRecordingState("idle");
      setElapsedTime(0);
    }
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
  };

  const handleRetake = () => {
    const updatedClips = clips.filter(c => c.phaseId !== currentPhase);
    setClips(updatedClips);
    setRecordingState("idle");
    setElapsedTime(0);
  };

  const handleDeleteClip = (clipId: string) => {
    setClips(clips.filter(c => c.id !== clipId));
  };

  const handlePhaseSkip = (phase: Phase) => {
    console.log(`Skipping to phase ${phase}`);
    setCurrentPhase(phase);
    setRecordingState("idle");
    setElapsedTime(0);
  };

  const currentPhaseHasRecording = clips.some(c => c.phaseId === currentPhase);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavigationSidebar activeItem={activeNav} onItemClick={setActiveNav} />

      <div className="flex-1 flex flex-col">
        <Header projectName="My Video Tour" />

        <main className="flex-1 overflow-auto">
          <div className="h-full flex flex-col p-8 gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <PhaseIndicator currentPhase={currentPhase} phases={phases} />
                <div className="flex items-center gap-2 px-4 py-2 bg-card/30 backdrop-blur-md rounded-lg border border-card-border">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Quick Nav:</span>
                  <Button
                    size="sm"
                    variant={currentPhase === 1 ? "default" : "ghost"}
                    onClick={() => handlePhaseSkip(1)}
                    data-testid="button-skip-phase-1"
                    className="h-7"
                  >
                    Phase 1
                  </Button>
                  <Button
                    size="sm"
                    variant={currentPhase === 2 ? "default" : "ghost"}
                    onClick={() => handlePhaseSkip(2)}
                    data-testid="button-skip-phase-2"
                    className="h-7"
                  >
                    Phase 2
                  </Button>
                  <Button
                    size="sm"
                    variant={currentPhase === 3 ? "default" : "ghost"}
                    onClick={() => handlePhaseSkip(3)}
                    data-testid="button-skip-phase-3"
                    className="h-7"
                  >
                    Phase 3
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RecordingStatus
                  isRecording={recordingState === "recording"}
                  elapsedTime={elapsedTime}
                />
                <StorageIndicator usedGB={2.4} totalGB={10} />
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-6">
                {currentPhase === 1 && recordingState === "idle" && !currentPhaseHasRecording && (
                  <div className="p-6 bg-card/30 backdrop-blur-md rounded-lg border border-card-border">
                    <h2 className="text-2xl font-semibold text-foreground mb-6">
                      Let's Get Started
                    </h2>
                    <IntroductionForm
                      name={name}
                      email={email}
                      onNameChange={setName}
                      onEmailChange={setEmail}
                    />
                  </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center gap-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      {recordingState === "stopped" && currentPhaseHasRecording
                        ? "Recording Saved!"
                        : phases[currentPhase - 1].title}
                    </h3>
                    <p className="text-muted-foreground">
                      {recordingState === "idle" && !currentPhaseHasRecording &&
                        "Click 'Start Recording' when you're ready"}
                      {recordingState === "recording" && "Recording in progress..."}
                      {recordingState === "paused" && "Recording paused"}
                      {recordingState === "stopped" && currentPhaseHasRecording &&
                        currentPhase < 3 &&
                        "Moving to next phase..."}
                      {recordingState === "stopped" && currentPhaseHasRecording &&
                        currentPhase === 3 &&
                        "All phases complete!"}
                    </p>
                  </div>

                  <RecordingControls
                    isRecording={recordingState === "recording" || recordingState === "paused"}
                    isPaused={recordingState === "paused"}
                    hasRecording={currentPhaseHasRecording && recordingState === "idle"}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                    onPause={handlePauseRecording}
                    onResume={handleResumeRecording}
                    onRetake={handleRetake}
                  />
                </div>
              </div>

              <div>
                <CameraPreview
                  isRecording={recordingState === "recording"}
                  hasVideo={currentPhaseHasRecording && recordingState === "idle"}
                />
              </div>
            </div>
          </div>

          {clips.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-6">
                <h3 className="text-lg font-semibold text-foreground">Recorded Clips</h3>
                <Button
                  variant="default"
                  className="bg-gradient-purple-blue"
                  onClick={() => setLocation("/editor")}
                  data-testid="button-edit-clips"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit & Export Clips
                </Button>
              </div>
              <Timeline
                clips={clips}
                onPlayClip={(id) => console.log("Play clip:", id)}
                onDeleteClip={handleDeleteClip}
                onAutoTrim={() => console.log("Auto-trim")}
              />
            </div>
          )}
        </main>
      </div>

      {recordingState === "countdown" && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}
    </div>
  );
}
