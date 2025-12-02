import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PILOTS } from "@/lib/constants";
import { CheckCircle2, Plane } from "lucide-react";

// Email validation helper
const isValidEmail = (email: string) => {
  if (!email) return true; // Email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Round up to next hour or half-hour
const getRoundedTime = () => {
  const now = new Date();
  const minutes = now.getMinutes();

  if (minutes === 0) {
    // Already on the hour
  } else if (minutes <= 30) {
    // Round up to next half hour
    now.setMinutes(30);
  } else {
    // Round up to next hour
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  }

  now.setSeconds(0);
  now.setMilliseconds(0);
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

// Get today's date in YYYY-MM-DD format (local timezone)
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CustomerIntakePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [flightDate, setFlightDate] = useState(getTodayDate());
  const [flightTime, setFlightTime] = useState(getRoundedTime());
  const [pilotName, setPilotName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [origin, setOrigin] = useState("");
  const [referral, setReferral] = useState("");
  const [purpose, setPurpose] = useState("");
  const [language, setLanguage] = useState("english");
  const [contactConsent, setContactConsent] = useState(false);
  const [waiverConsent, setWaiverConsent] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: {
      pilotName: string;
      pilotEmail: string;
      flightDate: string;
      flightTime: string;
      flightPilot: string;
      phone?: string;
      origin?: string;
      referral?: string;
      purpose?: string;
      language?: string;
      contactConsent?: boolean;
      waiverConsent?: boolean;
    }) => {
      // Create project in database (via Vercel API)
      const response = await apiRequest("POST", "/api/recordings", projectData);
      const project = await response.json();

      // Try to create Drive folder via local Mac server (optional)
      try {
        const driveFolderResponse = await fetch("http://localhost:3001/api/drive/create-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: project.id }),
        });

        if (driveFolderResponse.ok) {
          const folderData = await driveFolderResponse.json();
          return folderData.recording || project;
        }
      } catch (driveError) {
        console.warn("Could not create Drive folder:", driveError);
      }

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      setIsSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!fullName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }

    if (!flightTime) {
      toast({
        title: "Flight Time Required",
        description: "Please select your flight time.",
        variant: "destructive",
      });
      return;
    }

    if (!pilotName) {
      toast({
        title: "Pilot Required",
        description: "Please select your pilot.",
        variant: "destructive",
      });
      return;
    }

    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailError(true);
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address (e.g., name@example.com).",
        variant: "destructive",
      });
      return;
    }

    if (!waiverConsent) {
      toast({
        title: "Waiver Required",
        description: "You must accept the liability waiver to proceed.",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate({
      pilotName: fullName.trim(),
      pilotEmail: email.trim(),
      flightDate,
      flightTime,
      flightPilot: pilotName,
      phone: phone.trim() || undefined,
      origin: origin.trim() || undefined,
      referral: referral.trim() || undefined,
      purpose: purpose || undefined,
      language: language,
      contactConsent: contactConsent,
      waiverConsent: waiverConsent,
    });
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center bg-card/30 backdrop-blur-md border-card-border">
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You're All Set!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for completing the intake form. Your flight details have been recorded and we're ready for your adventure!
          </p>
          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">Your Flight</p>
            <p className="text-lg font-semibold text-foreground">{fullName}</p>
            <p className="text-muted-foreground">
              {new Date(flightDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })} at {(() => {
                const [hours, minutes] = flightTime.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
              })()}
            </p>
          </div>
          <Button
            onClick={() => {
              setIsSubmitted(false);
              setFullName("");
              setFlightDate(getTodayDate());
              setFlightTime(getRoundedTime());
              setPilotName("");
              setEmail("");
              setPhone("");
              setOrigin("");
              setReferral("");
              setPurpose("");
              setLanguage("english");
              setContactConsent(false);
              setWaiverConsent(false);
              setEmailError(false);
            }}
            variant="outline"
            className="w-full"
          >
            Submit Another
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-purple-blue rounded-full flex items-center justify-center mb-4">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Customer Intake Form</h1>
          <p className="text-muted-foreground mt-2">
            Please fill out the details below to help us customize your experience.
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-6 sm:p-8 bg-card/30 backdrop-blur-md border-card-border">
          <div className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-base">Full Name *</Label>
              <Input
                id="full-name"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors text-lg"
              />
            </div>

            {/* Flight Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flight-date" className="text-base">Flight Date *</Label>
                <Input
                  id="flight-date"
                  type="date"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flight-time" className="text-base">Flight Time *</Label>
                <Input
                  id="flight-time"
                  type="time"
                  value={flightTime}
                  onChange={(e) => setFlightTime(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                  }}
                  className={`h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors ${emailError ? "border-red-500 border-2" : ""}`}
                />
                {emailError && (
                  <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Origin & Referral */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-base">Where are you from?</Label>
                <Input
                  id="origin"
                  type="text"
                  placeholder="City, Country"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referral" className="text-base">How did you find Magnum?</Label>
                <Input
                  id="referral"
                  type="text"
                  placeholder="Instagram, Friend, Google..."
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Purpose & Pilot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purpose" className="text-base">What are you here for?</Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger id="purpose" className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors">
                    <SelectValue placeholder="Select a purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="special_event">Special Event</SelectItem>
                    <SelectItem value="bucket_list">Bucket List</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-name" className="text-base">Pilot *</Label>
                <Select value={pilotName} onValueChange={setPilotName}>
                  <SelectTrigger id="pilot-name" className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors">
                    <SelectValue placeholder="Select pilot" />
                  </SelectTrigger>
                  <SelectContent>
                    {PILOTS.map((pilot) => (
                      <SelectItem key={pilot.value} value={pilot.value}>
                        {pilot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Primary Language */}
            <div className="space-y-3">
              <Label className="text-base">Primary Language</Label>
              <RadioGroup
                value={language}
                onValueChange={setLanguage}
                className="grid grid-cols-3 sm:grid-cols-6 gap-2"
              >
                {[
                  { id: "english", label: "English", icon: "🇺🇸" },
                  { id: "spanish", label: "Spanish", icon: "🇪🇸" },
                  { id: "japanese", label: "Japanese", icon: "🇯🇵" },
                  { id: "chinese", label: "Chinese", icon: "🇨🇳" },
                  { id: "korean", label: "Korean", icon: "🇰🇷" },
                  { id: "french", label: "French", icon: "🇫🇷" },
                ].map((lang) => (
                  <div key={lang.id}>
                    <RadioGroupItem value={lang.id} id={`lang-${lang.id}`} className="peer sr-only" />
                    <Label
                      htmlFor={`lang-${lang.id}`}
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-secondary/30 p-3 sm:p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <span className="text-3xl sm:text-4xl mb-1">{lang.icon}</span>
                      <span className="text-xs font-medium">{lang.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Contact Consent */}
            <div className="flex flex-row items-start space-x-3 rounded-xl border p-4 bg-secondary/20">
              <Checkbox
                id="contact-consent"
                checked={contactConsent}
                onCheckedChange={(checked) => setContactConsent(checked === true)}
                className="mt-1"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="contact-consent" className="font-semibold text-sm cursor-pointer">
                  Permission to contact
                </Label>
                <p className="text-xs text-muted-foreground">
                  I agree to be contacted by Magnum regarding my flight and media package updates.
                </p>
              </div>
            </div>

            {/* Waiver Consent */}
            <div className="flex flex-row items-start space-x-3 rounded-xl border p-4 bg-red-500/5 border-red-500/20">
              <Checkbox
                id="waiver-consent"
                checked={waiverConsent}
                onCheckedChange={(checked) => setWaiverConsent(checked === true)}
                className="mt-1 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="waiver-consent" className="font-semibold text-sm text-red-700 dark:text-red-400 cursor-pointer">
                  Liability Waiver & Risk Agreement *
                </Label>
                <p className="text-xs text-red-600/80 dark:text-red-400/70">
                  I acknowledge that I have read, understood, and agree to the terms of the Flight Liability Waiver. I assume all risks associated with the activity.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={createProjectMutation.isPending || !waiverConsent}
              className="w-full h-14 text-lg bg-gradient-purple-blue hover:opacity-90"
            >
              {createProjectMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
