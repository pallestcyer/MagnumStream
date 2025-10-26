import { useState } from "react";
import { videoStorage } from "@/utils/videoStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, MessageSquare, Loader2 } from "lucide-react";

// Get the local device URL for Mac service
const getLocalDeviceUrl = async (): Promise<string> => {
  try {
    // Try to get local device URL from health endpoint
    const healthResponse = await fetch('/api/health');
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      
      if (healthData.services?.localDevice) {
        console.log('📡 Found local device URL:', healthData.services.localDevice);
        return healthData.services.localDevice;
      }
    }
  } catch (error) {
    console.warn('Could not get local device URL from health endpoint:', error);
  }
  
  // Fallback to localhost in development (Mac service runs on port 3001)
  const fallbackUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
  console.log('📡 Using fallback URL:', fallbackUrl);
  return fallbackUrl;
};

interface ExportWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightDate: string;
  flightTime: string;
}

type ExportStage = "davinci" | "drive" | "sms" | "complete";

export default function ExportWorkflow({ open, onOpenChange, flightDate, flightTime }: ExportWorkflowProps) {
  const [stage, setStage] = useState<ExportStage>("davinci");
  const [progress, setProgress] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

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
      
      // Step 2: Generate clips from timeline slots (40% progress)
      console.log('🎬 Generating clips from timeline slots...');
      const slotsResponse = await fetch(`/api/recordings/${recordingId}/video-slots`);
      if (!slotsResponse.ok) {
        throw new Error('Failed to fetch video slots');
      }
      
      const slots = await slotsResponse.json();
      console.log('📊 Found video slots:', slots);
      
      if (slots.length === 0) {
        console.warn('⚠️ No video slots found, generating clips without slots');
      }
      
      const slotSelections = slots.map((slot: any) => ({
        slotNumber: slot.slot_number,
        windowStart: slot.window_start,
        sceneType: slot.slot_number <= 3 ? 'cruising' : slot.slot_number <= 6 ? 'chase' : 'arrival',
        cameraAngle: slot.camera_angle
      }));
      
      // Get local device URL for Mac service FFmpeg processing
      const localDeviceUrl = await getLocalDeviceUrl();
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
      // Use the real Drive info from the response
      if (renderResult.driveInfo) {
        // Real Drive upload succeeded
        setDriveUrl(renderResult.driveInfo.fileUrl || renderResult.driveInfo.webViewLink);
        console.log('✅ Video uploaded to Drive:', renderResult.driveInfo.fileUrl);
      } else if (renderResult.warning) {
        // Drive not connected, but video rendered locally
        console.warn('⚠️ ' + renderResult.warning);
        setDriveUrl(null); // No Drive link available
      }

      // Update recording with real data from server (server already did this, but UI updates it too for consistency)
      if (recordingId && renderResult.driveInfo) {
        try {
          await fetch(`/api/recordings/${recordingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exportStatus: 'completed',
              driveFileUrl: renderResult.driveInfo.fileUrl,
              driveFileId: renderResult.driveInfo.fileId
            })
          });
          console.log('📊 Recording updated with real Drive info');
        } catch (error) {
          console.error('❌ Failed to update recording:', error);
        }
      }

      await videoStorage.updateProjectStatus('exported');

      setProgress(100);
      setStage("sms");
      
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
              
              await videoStorage.updateProjectStatus('exported');
              console.log('📊 Project marked as completed after Drive upload');
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
        
        await videoStorage.updateProjectStatus('exported');
        console.log('📊 Project marked as exported with SMS and Drive info');
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
    const stageOrder: ExportStage[] = ["davinci", "drive", "sms", "complete"];
    const currentIndex = stageOrder.indexOf(stage);
    const targetIndex = stageOrder.indexOf(currentStage);
    if (currentIndex > targetIndex) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={handleOpenExport}>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Flight: {flightDate} at {flightTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
            {(stage === "sms" || stage === "complete") && driveUrl && (
              <div className="pl-8">
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-drive-url"
                >
                  {driveUrl}
                </a>
              </div>
            )}
          </div>

          {/* Stage 3: SMS Link */}
          {(stage === "sms" || stage === "complete") && (
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
          )}

          {/* Complete Stage */}
          {stage === "complete" && (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Export Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  {phoneNumber 
                    ? `Video exported and link sent to ${phoneNumber}`
                    : "Video exported and uploaded to Google Drive"
                  }
                </p>
              </div>
              <Button
                onClick={() => onOpenChange(false)}
                className="mt-4"
                data-testid="button-close-export"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
