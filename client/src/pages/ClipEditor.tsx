import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Scissors, Download } from "lucide-react";
import NavigationSidebar from "@/components/NavigationSidebar";
import Header from "@/components/Header";
import FlightMetadataDialog from "@/components/FlightMetadataDialog";
import ExportWorkflow from "@/components/ExportWorkflow";

interface Clip {
  id: string;
  title: string;
  duration: number;
  phaseId: number;
  trimStart?: number;
  trimEnd?: number;
}

export default function ClipEditor() {
  const [, setLocation] = useLocation();
  const [activeNav, setActiveNav] = useState("recording");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [flightMetadata, setFlightMetadata] = useState({ date: "", time: "" });

  //todo: remove mock functionality - these would come from props or API
  const [clips, setClips] = useState<Clip[]>([
    { id: "1", title: "Phase 1: Introduction", duration: 45, phaseId: 1, trimStart: 0, trimEnd: 45 },
    { id: "2", title: "Phase 2: Main Tour", duration: 120, phaseId: 2, trimStart: 0, trimEnd: 120 },
    { id: "3", title: "Phase 3: Closing", duration: 30, phaseId: 3, trimStart: 0, trimEnd: 30 },
  ]);

  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const selectedClip = clips.find(c => c.id === selectedClipId);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    console.log(isPlaying ? "Paused" : "Playing");
  };

  const handleTimeChange = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const handleTrimStart = (clipId: string, newStart: number) => {
    setClips(clips.map(clip => 
      clip.id === clipId ? { ...clip, trimStart: newStart } : clip
    ));
    console.log(`Clip ${clipId} trim start: ${newStart}s`);
  };

  const handleTrimEnd = (clipId: string, newEnd: number) => {
    setClips(clips.map(clip => 
      clip.id === clipId ? { ...clip, trimEnd: newEnd } : clip
    ));
    console.log(`Clip ${clipId} trim end: ${newEnd}s`);
  };

  const handleExportClick = () => {
    setShowMetadataDialog(true);
  };

  const handleMetadataSubmit = (flightDate: string, flightTime: string) => {
    setFlightMetadata({ date: flightDate, time: flightTime });
    setShowExportDialog(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavigationSidebar activeItem={activeNav} onItemClick={setActiveNav} />

      <div className="flex-1 flex flex-col">
        <Header projectName="Flight Video Editor" onExport={handleExportClick} />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Back button */}
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Recording
            </Button>

            {/* Video Preview Area */}
            <div className="grid grid-cols-2 gap-6">
              <div className="relative aspect-video bg-card rounded-lg border border-card-border overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Camera 1 Preview</p>
                  </div>
                </div>
              </div>

              <div className="relative aspect-video bg-card rounded-lg border border-card-border overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Camera 2 Preview</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="bg-card/30 backdrop-blur-md rounded-lg border border-card-border p-6 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                  data-testid="button-skip-backward"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>

                <Button
                  size="icon"
                  variant="default"
                  className="w-14 h-14 bg-gradient-purple-blue"
                  onClick={handlePlayPause}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}
                  data-testid="button-skip-forward"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  onValueChange={handleTimeChange}
                  max={totalDuration}
                  step={0.1}
                  className="w-full"
                  data-testid="slider-timeline"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span data-testid="text-current-time">{formatTime(currentTime)}</span>
                  <span data-testid="text-total-duration">{formatTime(totalDuration)}</span>
                </div>
              </div>
            </div>

            {/* Clip Editor */}
            <div className="bg-card/30 backdrop-blur-md rounded-lg border border-card-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Clip Timeline</h2>
                <Button variant="outline" size="sm">
                  <Scissors className="w-4 h-4 mr-2" />
                  Auto-trim Silence
                </Button>
              </div>

              <div className="space-y-4">
                {clips.map((clip, index) => (
                  <div
                    key={clip.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedClipId === clip.id
                        ? "border-primary bg-primary/5"
                        : "border-card-border bg-card hover-elevate"
                    }`}
                    onClick={() => setSelectedClipId(clip.id)}
                    data-testid={`clip-editor-${clip.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-foreground">{clip.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatTime(clip.duration)}
                        </p>
                      </div>
                      <div className="text-sm font-mono text-muted-foreground">
                        {formatTime(clip.trimStart || 0)} - {formatTime(clip.trimEnd || clip.duration)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16">Trim Start</span>
                        <Slider
                          value={[clip.trimStart || 0]}
                          onValueChange={(value) => handleTrimStart(clip.id, value[0])}
                          max={clip.duration}
                          step={0.1}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-16 text-right">
                          {formatTime(clip.trimStart || 0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16">Trim End</span>
                        <Slider
                          value={[clip.trimEnd || clip.duration]}
                          onValueChange={(value) => handleTrimEnd(clip.id, value[0])}
                          max={clip.duration}
                          step={0.1}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-16 text-right">
                          {formatTime(clip.trimEnd || clip.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <Button
                size="lg"
                className="bg-gradient-purple-blue"
                onClick={handleExportClick}
                data-testid="button-start-export"
              >
                <Download className="w-5 h-5 mr-2" />
                Export Video
              </Button>
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
