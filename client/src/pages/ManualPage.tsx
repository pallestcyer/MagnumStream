import { Card } from "@/components/ui/card";
import { BookOpen, Video, Edit, Upload, CheckCircle, MessageSquare, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-purple-blue flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Staff Manual</h1>
            <p className="text-muted-foreground">Step-by-step guide to using Magnum Dashboard</p>
          </div>
        </div>

        <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Video className="w-6 h-6" />
            Complete Workflow Overview
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 1</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Info Page - Customer Setup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the customer's name(s), email, and select which staff member is recording. 
                  The system will show a live preview of both cameras to confirm they're working properly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 2</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Recording - Capture 3 Scenes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Record three scenes with dual cameras:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li><strong>Cruising Scene:</strong> Capture smooth flying footage (minimum 30 seconds)</li>
                  <li><strong>Chase Scene:</strong> Record dynamic chase angles (minimum 30 seconds)</li>
                  <li><strong>Arrival Scene:</strong> Film the landing approach (minimum 30 seconds)</li>
                </ul>
                <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2 font-semibold">
                  ⚠️ Important: Each scene must be at least 30 seconds long. The system won't allow shorter recordings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 3</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Editing - Select 3-Second Clips</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The editing workflow is split into 3 separate pages for each scene:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li><strong>Cruising Editor:</strong> Click on slots 1-3 to select your best 3-second moments</li>
                  <li><strong>Chase Editor:</strong> Click on slots 4-6 to pick exciting chase clips</li>
                  <li><strong>Arrival Editor:</strong> Click on slots 7-8 for landing highlights</li>
                </ul>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  💡 Tip: Click a slot card to activate it. The video preview will play your selected 3-second window while you adjust the timeline.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 4</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Export - Finalize & Share</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  After editing, export your video:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li>Enter flight date and time (automatically rounded to nearest hour/half-hour)</li>
                  <li>System exports to DaVinci Resolve format</li>
                  <li>Video is uploaded to Google Drive</li>
                  <li>SMS link sent to customer's phone</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Best Practices
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div>
                <p className="font-semibold text-foreground">Test Cameras First</p>
                <p className="text-sm text-muted-foreground">Always check the live preview on the Info page before starting</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div>
                <p className="font-semibold text-foreground">Record More Than 30 Seconds</p>
                <p className="text-sm text-muted-foreground">Aim for 45-60 seconds per scene to have more options when selecting clips</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div>
                <p className="font-semibold text-foreground">Use Phase Navigation</p>
                <p className="text-sm text-muted-foreground">Click the tabs at the top (Info → Recording → Editing → Export) to jump between phases</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div>
                <p className="font-semibold text-foreground">Save to History</p>
                <p className="text-sm text-muted-foreground">All recordings are automatically saved and accessible from the History page</p>
              </div>
            </li>
          </ul>
        </Card>

        <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border border-yellow-500/50">
          <h2 className="text-xl font-semibold text-foreground mb-3">Need Help?</h2>
          <p className="text-sm text-muted-foreground mb-3">
            If you encounter any issues or have questions:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Use the <strong>AI Chat</strong> page to ask questions and get instant help
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Submit problems through the <strong>Report Issue</strong> page
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
