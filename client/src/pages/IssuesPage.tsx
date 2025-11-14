import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function IssuesPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    staffName: "",
    issueType: "",
    priority: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staffName || !formData.issueType || !formData.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffName: formData.staffName,
          issueType: formData.issueType,
          priority: formData.priority || null,
          description: formData.description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit issue");
      }

      const result = await response.json();
      console.log("Issue submitted successfully:", result);

      setSubmitted(true);

      toast({
        title: "Issue Reported",
        description: "Your issue has been submitted successfully. Our team will review it shortly.",
      });

      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          staffName: "",
          issueType: "",
          priority: "",
          description: "",
        });
      }, 3000);
    } catch (error) {
      console.error("Error submitting issue:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your issue. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="p-12 bg-card/30 backdrop-blur-md border-card-border max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Issue Submitted!</h2>
          <p className="text-muted-foreground">
            Thank you for reporting this issue. Our team will investigate and get back to you soon.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-purple-blue flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Report an Issue</h1>
            <p className="text-muted-foreground">Let us know about any problems or errors you encounter</p>
          </div>
        </div>

        <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="staff-name">
                Your Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-name"
                placeholder="Enter your name"
                value={formData.staffName}
                onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                data-testid="input-staff-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-type">
                Issue Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.issueType}
                onValueChange={(value) => setFormData({ ...formData, issueType: value })}
              >
                <SelectTrigger id="issue-type" data-testid="select-issue-type">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Camera Not Working</SelectItem>
                  <SelectItem value="recording">Recording Failed</SelectItem>
                  <SelectItem value="editing">Editing Problem</SelectItem>
                  <SelectItem value="export">Export Error</SelectItem>
                  <SelectItem value="performance">Performance Issue</SelectItem>
                  <SelectItem value="ui">User Interface Bug</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority" data-testid="select-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                  <SelectItem value="medium">Medium - Affects workflow</SelectItem>
                  <SelectItem value="high">High - Blocks critical tasks</SelectItem>
                  <SelectItem value="critical">Critical - System unusable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the issue in detail. Include steps to reproduce if possible..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                data-testid="textarea-description"
              />
              <p className="text-xs text-muted-foreground">
                Please provide as much detail as possible to help us resolve the issue quickly
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-purple-blue"
              size="lg"
              data-testid="button-submit-issue"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Issue Report
            </Button>
          </form>
        </Card>

        <Card className="p-4 bg-card/30 backdrop-blur-md border-card-border border-blue-500/50">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Quick Tips
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Include specific error messages if any appeared</li>
            <li>• Note which browser you're using (Chrome, Firefox, etc.)</li>
            <li>• Mention when the issue started occurring</li>
            <li>• List steps to reproduce the problem</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
