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
                <h3 className="font-semibold text-foreground">Editing - Select 14 Video Clips</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The editing workflow is split into 3 separate pages for each scene. Select the best moments from your footage - each slot has a specific duration that matches the final video template:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li><strong>Cruising Editor:</strong> Select 7 clips (slots 1-7) alternating between front and side camera views</li>
                  <li><strong>Chase Editor:</strong> Select 6 clips (slots 8-13) with dynamic chase angles</li>
                  <li><strong>Arrival Editor:</strong> Select 1 clip (slot 14) showing the landing approach</li>
                </ul>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  💡 Tip: Click a slot card to activate it. The video preview will play your selected clip duration while you adjust the timeline. Each slot has a preset duration (ranging from 0.5 to 3.2 seconds) for a total final video of approximately 17 seconds.
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                  ✨ Smart Feature: Some slots are paired for seamless camera transitions. When you adjust the timing of certain slots, the next slot will automatically position itself to create smooth continuity between camera angles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 4</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Render - Automated Video Production</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  After selecting all 14 clips, click the "Render" button to start the automated process:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li>System extracts all 14 clips from your source videos using FFmpeg</li>
                  <li>DaVinci Resolve automatically imports clips and replaces template footage</li>
                  <li>Final video is rendered (approximately 17 seconds long)</li>
                  <li>Video is automatically copied to Google Drive for syncing</li>
                  <li>Video appears on the Sales page once rendering is complete</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  The entire rendering process is fully automated and typically takes 2-3 minutes. You can track the status in the Export Workflow page.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Badge className="mt-1">Step 5</Badge>
              <div>
                <h3 className="font-semibold text-foreground">Sales Page - Preview & Deliver</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Once rendering is complete, use the Sales page to preview and share videos with customers:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4 space-y-1">
                  <li><strong>Play Button:</strong> Opens video in QuickTime for instant local preview</li>
                  <li><strong>Drive Icon:</strong> Opens Google Drive to get a shareable link for the customer</li>
                  <li><strong>Create Sale:</strong> Records the purchase and marks the video as sold</li>
                </ul>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✅ Videos are organized by date in Google Drive and automatically sync to the cloud for easy sharing with customers.
                </p>
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
                <p className="text-sm text-muted-foreground">Aim for 45-60 seconds per scene to have more options when selecting the 14 clips. More footage means more flexibility in finding the perfect moments.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div>
                <p className="font-semibold text-foreground">Trust the Seamless Transitions</p>
                <p className="text-sm text-muted-foreground">When editing paired slots, the system automatically positions clips for smooth camera angle changes. Just focus on selecting great moments.</p>
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
