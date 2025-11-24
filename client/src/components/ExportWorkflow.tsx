import { useState } from "react";
import { useLocation } from "wouter";
import { videoStorage } from "@/utils/videoStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input"; // Unused - SMS feature disabled
// import { Label } from "@/components/ui/label"; // Unused - SMS feature disabled
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2 } from "lucide-react"; // MessageSquare removed - SMS feature disabled

// Get the local device URL for Mac service
// Since the Vercel frontend is accessed from the same Mac that runs the local server,
// we always use localhost:3001 for FFmpeg/DaVinci operations
const getLocalDeviceUrl = (): string => {
  return 'http://localhost:3001';
};

interface ExportWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightDate: string;
  flightTime: string;
}

type ExportStage = "davinci" | "drive" | "complete"; // | "sms" - SMS feature disabled for now

export default function ExportWorkflow({ open, onOpenChange, flightDate, flightTime }: ExportWorkflowProps) {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<ExportStage>("davinci");
  const [progress, setProgress] = useState(0);
  // const [phoneNumber, setPhoneNumber] = useState(""); // Unused - SMS feature disabled
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  const startExport = async () => {
    // Stage 1: DaVinci Export - Upload videos and generate clips
    setStage("davinci");
    setProgress(0);
    
    try {
      const recordingId = localStorage.getItem('currentRecordingId');
      if (!recordingId) {
        throw new Error('No recording ID found');
      }

      console.log('🎬 Starting export process for recording:', recordingId);
      
      // Step 1: Upload videos from IndexedDB to server (20% progress)
      setProgress(20);
      console.log('📤 Uploading videos to server...');
      const uploadSuccess = await videoStorage.uploadSessionVideosToServer(recordingId);
      
      if (!uploadSuccess) {
        throw new Error('Failed to upload videos to server');
      }
      
      setProgress(40);
      console.log('✅ Videos uploaded successfully');
      
      // Step 2: Generate clips from ALL 14 timeline slots (40% progress)
      console.log('🎬 Generating clips for all 14 slots...');

      // Fetch any custom slot selections from database (user-edited windowStart times)
      const slotsResponse = await fetch(`/api/recordings/${recordingId}/video-slots`);
      const customSlots = slotsResponse.ok ? await slotsResponse.json() : [];
      console.log('📊 Found custom video slots:', customSlots);

      // Create a map of custom slot timings
      const customSlotMap = new Map(
        customSlots.map((slot: any) => [slot.slot_number, slot.window_start])
      );

      // Always generate ALL 14 slots based on SLOT_TEMPLATE
      // Use custom windowStart if available, otherwise use default (0)
      const SLOT_TEMPLATE = [
        { slotNumber: 1, sceneType: 'cruising', cameraAngle: 2 },
        { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2 },
        { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1 },
        { slotNumber: 4, sceneType: 'cruising', cameraAngle: 2 },
        { slotNumber: 5, sceneType: 'cruising', cameraAngle: 1 },
        { slotNumber: 6, sceneType: 'cruising', cameraAngle: 2 },
        { slotNumber: 7, sceneType: 'cruising', cameraAngle: 1 },
        { slotNumber: 8, sceneType: 'chase', cameraAngle: 2 },
        { slotNumber: 9, sceneType: 'chase', cameraAngle: 1 },
        { slotNumber: 10, sceneType: 'chase', cameraAngle: 2 },
        { slotNumber: 11, sceneType: 'chase', cameraAngle: 2 },
        { slotNumber: 12, sceneType: 'chase', cameraAngle: 1 },
        { slotNumber: 13, sceneType: 'chase', cameraAngle: 1 },
        { slotNumber: 14, sceneType: 'arrival', cameraAngle: 1 },
      ];

      const slotSelections = SLOT_TEMPLATE.map(slot => ({
        slotNumber: slot.slotNumber,
        windowStart: customSlotMap.get(slot.slotNumber) || 0,
        sceneType: slot.sceneType as 'cruising' | 'chase' | 'arrival',
        cameraAngle: slot.cameraAngle as 1 | 2
      }));

      console.log('🎬 Generating all 14 slots:', slotSelections.map(s => s.slotNumber));
      
      // Get local device URL for Mac service FFmpeg processing
      const localDeviceUrl = getLocalDeviceUrl();
      console.log('🎬 Using Mac service for clip generation:', localDeviceUrl);
      
      const clipsResponse = await fetch(`${localDeviceUrl}/api/recordings/${recordingId}/generate-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotSelections })
      });
      
      if (!clipsResponse.ok) {
        throw new Error('Failed to generate clips');
      }
      
      const clipsResult = await clipsResponse.json();
      console.log('🎬 Clips generated:', clipsResult);
      
      setProgress(70);

      // Note: Google Drive OAuth is now handled automatically on the backend
      // via google-drive-tokens.json (Mac) or GOOGLE_REFRESH_TOKEN env var (Vercel)
      // The render process will populate driveFolderUrl if OAuth is configured

      // Step 3: Start DaVinci render (this is a long-running operation)
      console.log('📄 Creating DaVinci job file and starting render...');
      setStage("davinci");
      setProgress(75);

      // This request will take 30 seconds to 2+ minutes - server waits for actual render completion
      const davinciResponse = await fetch(`${localDeviceUrl}/api/recordings/${recordingId}/render-davinci`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: `${flightDate}_${flightTime.replace(':', '')}_Final`
        })
      });

      if (!davinciResponse.ok) {
        throw new Error('Failed to render with DaVinci Resolve');
      }

      const renderResult = await davinciResponse.json();
      console.log('🎬 DaVinci render completed:', renderResult);

      // DaVinci is done, now show Drive upload stage
      setStage("drive");
      setProgress(85);

      // Server has already uploaded to Drive (or skipped if not connected)
      // Use the real Drive folder URL (not search URL) from the response
      if (renderResult.driveInfo) {
        // Real Drive upload succeeded - use folder URL which directly opens the folder
        const folderUrl = renderResult.driveInfo.folderUrl;
        setDriveUrl(folderUrl);
        console.log('✅ Video uploaded to Drive folder:', folderUrl);
      } else if (renderResult.warning) {
        // Drive not connected, but video rendered locally
        console.warn('⚠️ ' + renderResult.warning);
        setDriveUrl(null); // No Drive link available
      }

      // Backend already updated the recording with all Drive info and status
      // No need to update again from frontend - just log success
      console.log('📊 Recording completed by backend with Drive info');

      setProgress(100);
      setStage("complete"); // Skip SMS stage - go directly to complete

    } catch (error) {
      console.error('❌ Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Export failed: ${errorMessage}`);
      onOpenChange(false);
    }
  };

  const uploadToDrive = async () => {
    setStage("drive");
    setProgress(0);

    // Simulate Drive upload
    const driveInterval = setInterval(async () => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(driveInterval);
          // Simulated Drive URL
          setDriveUrl("https://drive.google.com/file/d/1AbCdEfG123/view");
          
          // Mark project as completed when Drive upload finishes
          setTimeout(async () => {
            try {
              const recordingId = localStorage.getItem('currentRecordingId');
              if (recordingId) {
                // Update recording status to completed (but NOT sold)
                await fetch(`/api/recordings/${recordingId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    exportStatus: 'completed',
                    driveFileUrl: "https://drive.google.com/file/d/1AbCdEfG123/view"
                  })
                });

                console.log('📊 Project marked as completed (ready for manual sale if desired)');
              }

              // Recording already created and updated - no need to update status again
              console.log('📊 Recording completed with Drive info');
            } catch (error) {
              console.error('❌ Failed to update export status after Drive upload:', error);
            }
          }, 100);
          
          setStage("sms");
          setProgress(100);
          return 100;
        }
        return prev + 25;
      });
    }, 500);
  };

  const sendSMS = async () => {
    if (!phoneNumber) {
      alert("Please enter a phone number");
      return;
    }

    console.log(`Sending SMS to ${phoneNumber} with link: ${driveUrl}`);
    
    // Simulate SMS sending
    setTimeout(async () => {
      // Mark project as exported and update with SMS info
      try {
        const recordingId = localStorage.getItem('currentRecordingId');
        if (recordingId) {
          // Update with SMS phone number and drive URL
          await fetch(`/api/recordings/${recordingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exportStatus: 'completed',
              smsPhoneNumber: phoneNumber,
              driveFileUrl: driveUrl
            })
          });
        }

        // Recording already completed by backend - just log SMS sent
        console.log('📊 SMS info added to recording');
      } catch (error) {
        console.error('❌ Failed to update export status:', error);
      }
      setStage("complete");
    }, 1000);
  };

  const handleOpenExport = () => {
    startExport();
  };

  const getStageIcon = (currentStage: ExportStage) => {
    if (stage === "complete") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (stage === currentStage) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    const stageOrder: ExportStage[] = ["davinci", "drive", "complete"]; // SMS removed
    const currentIndex = stageOrder.indexOf(stage);
    const targetIndex = stageOrder.indexOf(currentStage);
    if (currentIndex > targetIndex) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onOpenAutoFocus={handleOpenExport}>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription className="truncate">
            Flight: {flightDate} at {flightTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-x-hidden">
          {/* Stage 1: DaVinci Export */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {getStageIcon("davinci")}
              <span className={`font-medium ${stage === "davinci" ? "text-foreground" : "text-muted-foreground"}`}>
                Exporting to DaVinci Resolve
              </span>
            </div>
            {stage === "davinci" && (
              <Progress value={progress} className="h-2" />
            )}
          </div>

          {/* Stage 2: Google Drive Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {getStageIcon("drive")}
              <span className={`font-medium ${stage === "drive" ? "text-foreground" : "text-muted-foreground"}`}>
                Uploading to Google Drive
              </span>
            </div>
            {stage === "drive" && (
              <Progress value={progress} className="h-2" />
            )}
            {stage === "complete" && driveUrl && (
              <div className="pl-8">
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                  data-testid="link-drive-url"
                >
                  View in Google Drive
                </a>
              </div>
            )}
          </div>

          {/* Stage 3: SMS Link - DISABLED FOR NOW */}
          {/* {(stage === "sms" || stage === "complete") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getStageIcon("sms")}
                <span className={`font-medium ${stage === "sms" ? "text-foreground" : "text-muted-foreground"}`}>
                  Send Link via SMS
                </span>
              </div>
              {stage === "sms" && (
                <div className="pl-8 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-12"
                      data-testid="input-phone-number"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={sendSMS}
                      className="flex-1 bg-gradient-purple-blue"
                      data-testid="button-send-sms"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send Text Link
                    </Button>
                    <Button
                      onClick={() => setStage("complete")}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-skip-sms"
                    >
                      Skip SMS
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )} */}

          {/* Complete Stage */}
          {stage === "complete" && (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Export Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Video has been rendered and uploaded to Google Drive
                </p>
              </div>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setLocation('/projects');
                }}
                className="mt-4"
                data-testid="button-close-export"
              >
                Go to Projects
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
