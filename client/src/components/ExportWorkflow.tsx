import { useState } from "react";
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
import { CheckCircle2, Upload, MessageSquare, Loader2 } from "lucide-react";

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
    // Stage 1: DaVinci Export (5 seconds)
    setStage("davinci");
    setProgress(0);
    
    const davinciInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(davinciInterval);
          // Move to Drive upload
          setTimeout(() => {
            uploadToDrive();
          }, 500);
          return 100;
        }
        return prev + 20;
      });
    }, 1000);
  };

  const uploadToDrive = async () => {
    setStage("drive");
    setProgress(0);

    // Simulate Drive upload
    const driveInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(driveInterval);
          // Simulated Drive URL
          setDriveUrl("https://drive.google.com/file/d/1AbCdEfG123/view");
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
    setTimeout(() => {
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
                  <Button
                    onClick={sendSMS}
                    className="w-full bg-gradient-purple-blue"
                    data-testid="button-send-sms"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Text Link
                  </Button>
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
                  Video exported and link sent to {phoneNumber}
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
