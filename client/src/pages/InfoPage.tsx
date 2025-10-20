import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, VideoOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePilot } from "@/contexts/PilotContext";
import PhaseNavigation from "@/components/PhaseNavigation";

export default function InfoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { pilotInfo, setPilotInfo } = usePilot();
  
  // Split existing name by " & " if it exists
  const existingNames = pilotInfo.name ? pilotInfo.name.split(" & ") : ["", ""];
  const [firstName1, setFirstName1] = useState(existingNames[0] || "");
  const [firstName2, setFirstName2] = useState(existingNames[1] || "");
  const [email, setEmail] = useState(pilotInfo.email || "");
  const [staffMember, setStaffMember] = useState(pilotInfo.staffMember || "");
  const [camera1Stream, setCamera1Stream] = useState<MediaStream | null>(null);
  const [camera2Stream, setCamera2Stream] = useState<MediaStream | null>(null);
  const [camera1Ready, setCamera1Ready] = useState(false);
  const [camera2Ready, setCamera2Ready] = useState(false);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeCameras();
    return () => {
      stopCameras();
    };
  }, []);

  const initializeCameras = async () => {
    try {
      // Get all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length < 2) {
        toast({
          title: "Camera Setup",
          description: `Found ${videoDevices.length} camera(s). Two cameras recommended for best results.`,
          variant: "default",
        });
      }

      // Camera 1 (straight on)
      const stream1 = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoDevices[0]?.deviceId }
      });
      setCamera1Stream(stream1);
      if (video1Ref.current) {
        video1Ref.current.srcObject = stream1;
        video1Ref.current.play();
        setCamera1Ready(true);
      }

      // Camera 2 (side view) if available
      if (videoDevices.length >= 2) {
        const stream2 = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: videoDevices[1]?.deviceId }
        });
        setCamera2Stream(stream2);
        if (video2Ref.current) {
          video2Ref.current.srcObject = stream2;
          video2Ref.current.play();
          setCamera2Ready(true);
        }
      }
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to continue.",
        variant: "destructive",
      });
    }
  };

  const stopCameras = () => {
    camera1Stream?.getTracks().forEach(track => track.stop());
    camera2Stream?.getTracks().forEach(track => track.stop());
  };

  const handleContinue = () => {
    if (!firstName1.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter at least the first customer name to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!camera1Ready) {
      toast({
        title: "Camera Not Ready",
        description: "Please ensure at least Camera 1 is connected and ready.",
        variant: "destructive",
      });
      return;
    }

    // Store info and navigate to recording
    const combinedName = firstName2.trim() 
      ? `${firstName1.trim()} & ${firstName2.trim()}`
      : firstName1.trim();
    setPilotInfo({ name: combinedName, email, staffMember });
    setLocation("/recording");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex flex-col">
      <PhaseNavigation currentPhase="info" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground bg-gradient-purple-blue bg-clip-text text-transparent">
            Flight Recording Setup
          </h1>
          <p className="text-muted-foreground text-lg">
            Enter your information and confirm your cameras are ready
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Info Form */}
          <Card className="p-8 bg-card/30 backdrop-blur-md border-card-border">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Customer Information</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                <div className="space-y-2">
                  <Label htmlFor="first-name-1">First Name *</Label>
                  <Input
                    id="first-name-1"
                    type="text"
                    placeholder="Emily"
                    value={firstName1}
                    onChange={(e) => setFirstName1(e.target.value)}
                    className="h-12"
                    data-testid="input-first-name-1"
                  />
                </div>
                <div className="text-2xl font-bold text-muted-foreground pb-3">&</div>
                <div className="space-y-2">
                  <Label htmlFor="first-name-2">First Name (Optional)</Label>
                  <Input
                    id="first-name-2"
                    type="text"
                    placeholder="John"
                    value={firstName2}
                    onChange={(e) => setFirstName2(e.target.value)}
                    className="h-12"
                    data-testid="input-first-name-2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pilot-email">Email (Optional)</Label>
                <Input
                  id="pilot-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  data-testid="input-pilot-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-member">Staff Member Recording</Label>
                <Select value={staffMember} onValueChange={setStaffMember}>
                  <SelectTrigger id="staff-member" className="h-12" data-testid="select-staff-member">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="john">John Smith</SelectItem>
                    <SelectItem value="sarah">Sarah Johnson</SelectItem>
                    <SelectItem value="michael">Michael Chen</SelectItem>
                    <SelectItem value="emily">Emily Rodriguez</SelectItem>
                    <SelectItem value="david">David Williams</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  className="w-full bg-gradient-purple-blue h-14 text-lg"
                  onClick={handleContinue}
                  disabled={!firstName1.trim() || !camera1Ready}
                  data-testid="button-continue-to-recording"
                >
                  Continue to Recording
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Camera Preview */}
          <Card className="p-8 bg-card/30 backdrop-blur-md border-card-border">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Camera Preview</h2>
            <div className="space-y-6">
              {/* Camera 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Camera 1 (Straight On)</Label>
                  {camera1Ready ? (
                    <CheckCircle2 className="w-5 h-5 text-orange-500" data-testid="status-camera1-ready" />
                  ) : (
                    <VideoOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden border-2 border-orange-500/50">
                  <video
                    ref={video1Ref}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                    data-testid="video-camera1-preview"
                  />
                  {!camera1Ready && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Camera 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Camera 2 (Side View)</Label>
                  {camera2Ready ? (
                    <CheckCircle2 className="w-5 h-5 text-orange-500" data-testid="status-camera2-ready" />
                  ) : (
                    <VideoOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden border-2 border-orange-500/50">
                  <video
                    ref={video2Ref}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                    data-testid="video-camera2-preview"
                  />
                  {!camera2Ready && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                {camera1Ready && camera2Ready
                  ? "Both cameras are ready!"
                  : camera1Ready
                  ? "Camera 1 ready. Camera 2 optional."
                  : "Waiting for camera access..."}
              </p>
            </div>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
