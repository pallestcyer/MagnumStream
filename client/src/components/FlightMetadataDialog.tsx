import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Calendar } from "lucide-react";

interface FlightMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (flightDate: string, flightTime: string, pilotName?: string) => void;
}

// Round up to next hour or half-hour
const getRoundedTime = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  
  if (minutes === 0) {
    // Already on the hour
    return now;
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
  return now;
};

export default function FlightMetadataDialog({ open, onOpenChange, onSubmit }: FlightMetadataDialogProps) {
  const [flightDate, setFlightDate] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [pilotName, setPilotName] = useState("");
  
  // Auto-populate with current date and rounded time
  useEffect(() => {
    if (open && !flightDate && !flightTime) {
      const rounded = getRoundedTime();
      const dateStr = rounded.toISOString().split('T')[0];
      const timeStr = `${rounded.getHours().toString().padStart(2, '0')}:${rounded.getMinutes().toString().padStart(2, '0')}`;
      setFlightDate(dateStr);
      setFlightTime(timeStr);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!flightDate || !flightTime) {
      alert("Please enter both flight date and time");
      return;
    }
    onSubmit(flightDate, flightTime, pilotName || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Flight Information
          </DialogTitle>
          <DialogDescription>
            Enter the flight date and time before exporting your video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="flight-date">Flight Date</Label>
            <Input
              id="flight-date"
              type="date"
              value={flightDate}
              onChange={(e) => setFlightDate(e.target.value)}
              className="h-12"
              data-testid="input-flight-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flight-time">
              Flight Time
              <span className="text-xs text-muted-foreground ml-2">(auto-rounded to next hour/half-hour)</span>
            </Label>
            <Input
              id="flight-time"
              type="time"
              value={flightTime}
              onChange={(e) => setFlightTime(e.target.value)}
              className="h-12"
              data-testid="input-flight-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pilot-name">
              Pilot Name (Optional)
              <span className="text-xs text-muted-foreground ml-2">Select from common pilots</span>
            </Label>
            <Select value={pilotName} onValueChange={setPilotName}>
              <SelectTrigger id="pilot-name" className="h-12" data-testid="select-pilot-name">
                <SelectValue placeholder="Choose pilot (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="captain-james">Captain James Morrison</SelectItem>
                <SelectItem value="captain-sarah">Captain Sarah Thompson</SelectItem>
                <SelectItem value="captain-michael">Captain Michael Rodriguez</SelectItem>
                <SelectItem value="captain-emily">Captain Emily Chen</SelectItem>
                <SelectItem value="captain-david">Captain David Wilson</SelectItem>
                <SelectItem value="captain-lisa">Captain Lisa Anderson</SelectItem>
                <SelectItem value="captain-robert">Captain Robert Johnson</SelectItem>
                <SelectItem value="captain-maria">Captain Maria Garcia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-metadata"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-gradient-purple-blue"
            data-testid="button-submit-metadata"
          >
            Continue to Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
