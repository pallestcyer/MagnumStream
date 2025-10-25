import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PhaseNavigation from "@/components/PhaseNavigation";
import { 
  Calendar, 
  ExternalLink, 
  Download, 
  MessageSquare, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit3,
  PlayCircle,
  Target,
  Clapperboard
} from "lucide-react";

interface ProjectRecord {
  id: string;
  projectName: string;
  pilotName: string;
  pilotEmail?: string;
  staffMember?: string;
  flightDate: string;
  flightTime: string;
  exportStatus: "pending" | "recorded" | "in_progress" | "completed" | "failed";
  createdAt: Date;
  driveUrl?: string;
  smsPhoneNumber?: string;
  timelinePositions?: number;
  clipsGenerated?: number;
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects from API
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/recordings');
        if (response.ok) {
          const recordings = await response.json();
          
          // Enhance each recording with timeline and clip info
          const projectRecords: ProjectRecord[] = await Promise.all(
            recordings.map(async (recording: any) => {
              let timelinePositions = 0;
              let clipsGenerated = 0;
              
              try {
                // Get timeline positions
                const slotsResponse = await fetch(`/api/recordings/${recording.id}/video-slots`);
                if (slotsResponse.ok) {
                  const slots = await slotsResponse.json();
                  timelinePositions = slots.length;
                }
                
                // Get generated clips info
                const clipsResponse = await fetch(`/api/recordings/${recording.id}/clips`);
                if (clipsResponse.ok) {
                  const clips = await clipsResponse.json();
                  clipsGenerated = clips.length;
                }
              } catch (error) {
                console.warn(`Failed to fetch additional data for ${recording.id}:`, error);
              }
              
              return {
                id: recording.id,
                projectName: recording.projectName,
                pilotName: recording.pilotName,
                pilotEmail: recording.pilotEmail,
                staffMember: recording.staffMember,
                flightDate: recording.flightDate || new Date().toISOString().split('T')[0],
                flightTime: recording.flightTime || '00:00',
                exportStatus: recording.exportStatus,
                createdAt: new Date(recording.createdAt),
                driveUrl: recording.driveFileUrl,
                smsPhoneNumber: recording.smsPhoneNumber,
                timelinePositions,
                clipsGenerated
              };
            })
          );
          
          setProjects(projectRecords);
        } else {
          console.error('Failed to fetch recordings:', response.statusText);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Filter projects by status
  const inProgressProjects = projects.filter(p => 
    ['pending', 'recorded', 'in_progress'].includes(p.exportStatus)
  );
  const completedProjects = projects.filter(p => 
    ['completed', 'failed'].includes(p.exportStatus)
  );

  // Debug logging
  console.log('📊 HistoryPage projects loaded:', {
    totalProjects: projects.length,
    inProgress: inProgressProjects.length,
    completed: completedProjects.length,
    projectStatuses: projects.map(p => ({ name: p.projectName, status: p.exportStatus }))
  });

  const getStatusBadge = (status: ProjectRecord['exportStatus']) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="default" className="bg-red-500/20 text-red-500 border-red-500/50">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "recorded":
        return (
          <Badge variant="default" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
            <PlayCircle className="w-3 h-3 mr-1" />
            Recorded
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-orange-500/20 text-orange-500 border-orange-500/50">
            <Edit3 className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhaseNavigation currentPhase="export" completedPhases={["info", "recording", "editing"]} />

      <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Project History</h1>
              <p className="text-muted-foreground">
                View all your flight recordings and their current status
              </p>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading projects...</p>
              </div>
            )}

            {/* Stats Cards */}
            {!loading && (
              <>
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Projects</p>
                        <h3 className="text-3xl font-bold text-foreground mt-1">
                          {projects.length}
                        </h3>
                      </div>
                      <Download className="w-10 h-10 text-primary/50" />
                    </div>
                  </Card>

                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <h3 className="text-3xl font-bold text-orange-500 mt-1">
                          {inProgressProjects.length}
                        </h3>
                      </div>
                      <Edit3 className="w-10 h-10 text-orange-500/50" />
                    </div>
                  </Card>

                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <h3 className="text-3xl font-bold text-green-500 mt-1">
                          {completedProjects.length}
                        </h3>
                      </div>
                      <CheckCircle2 className="w-10 h-10 text-green-500/50" />
                    </div>
                  </Card>
                </div>

                {/* Project Records Tabs */}
                <Tabs defaultValue="in-progress" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="in-progress" className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      In Progress ({inProgressProjects.length})
                    </TabsTrigger>
                    <TabsTrigger value="done" className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Done ({completedProjects.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="in-progress" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-foreground">In Progress Projects</h2>
                      <p className="text-sm text-muted-foreground">
                        Projects that have been recorded but not fully exported
                      </p>
                    </div>

                    {inProgressProjects.length === 0 ? (
                      <Card className="p-12 bg-card/30 backdrop-blur-md border-card-border text-center">
                        <Edit3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          No projects in progress
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Projects that are recorded but not fully exported will appear here.
                        </p>
                      </Card>
                    ) : (
                      inProgressProjects.map((record) => (
                        <ProjectCard key={record.id} record={record} getStatusBadge={getStatusBadge} formatDate={formatDate} />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="done" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-foreground">Completed Projects</h2>
                      <p className="text-sm text-muted-foreground">
                        Projects that have been fully exported
                      </p>
                    </div>

                    {completedProjects.length === 0 ? (
                      <Card className="p-12 bg-card/30 backdrop-blur-md border-card-border text-center">
                        <CheckCircle2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          No completed projects
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Fully exported projects will appear here.
                        </p>
                      </Card>
                    ) : (
                      completedProjects.map((record) => (
                        <ProjectCard key={record.id} record={record} getStatusBadge={getStatusBadge} formatDate={formatDate} />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
    </div>
  );
}

interface ProjectCardProps {
  record: ProjectRecord;
  getStatusBadge: (status: ProjectRecord['exportStatus']) => JSX.Element;
  formatDate: (date: Date) => string;
}

function ProjectCard({ record, getStatusBadge, formatDate }: ProjectCardProps) {
  return (
    <Card
      className="p-6 bg-card/30 backdrop-blur-md border-card-border hover-elevate"
      data-testid={`project-record-${record.id}`}
    >
      <div className="space-y-4">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {record.pilotName}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {record.projectName}
            </p>
          </div>
          {getStatusBadge(record.exportStatus)}
        </div>

        {/* Details Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Flight Date & Time</p>
              <p className="text-sm font-medium text-foreground">
                {record.flightDate} at {record.flightTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Created On</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(record.createdAt)}
              </p>
            </div>
          </div>

          {(record.timelinePositions || 0) > 0 && record.exportStatus !== 'completed' && (
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Timeline Positions</p>
                <p className="text-sm font-medium text-foreground">
                  {record.timelinePositions || 0} slots configured
                </p>
              </div>
            </div>
          )}

          {(record.clipsGenerated || 0) > 0 && (
            <div className="flex items-center gap-3">
              <Clapperboard className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Generated Clips</p>
                <p className="text-sm font-medium text-foreground">
                  {record.clipsGenerated || 0} clips ready
                </p>
              </div>
            </div>
          )}

          {record.driveUrl && (
            <div className="flex items-center gap-3">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Google Drive</p>
                <a
                  href={record.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                  data-testid={`link-drive-${record.id}`}
                >
                  View File
                </a>
              </div>
            </div>
          )}

          {record.smsPhoneNumber && (
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">SMS Sent To</p>
                <p className="text-sm font-medium text-foreground font-mono">
                  {record.smsPhoneNumber}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {record.exportStatus === "completed" && record.driveUrl && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(record.driveUrl, '_blank')}
              data-testid={`button-open-drive-${record.id}`}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Open in Drive
            </Button>
          </div>
        )}
        
        {/* Resume editing for in-progress projects */}
        {(() => {
          const canResume = ['pending', 'recorded', 'in_progress'].includes(record.exportStatus);
          console.log(`📊 Project ${record.projectName} (${record.exportStatus}) can resume: ${canResume}`);
          return canResume;
        })() && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="bg-gradient-purple-blue"
              onClick={() => {
                // Set the session and recording ID for resuming project
                const sessionId = record.pilotName.toLowerCase().replace(/[^a-z0-9\s&]/g, '').replace(/\s+/g, '_');
                localStorage.setItem('currentSessionId', sessionId);
                localStorage.setItem('currentRecordingId', record.id);
                localStorage.setItem('pilotEmail', record.pilotEmail || '');
                localStorage.setItem('staffMember', record.staffMember || '');
                console.log('🔄 Resuming project:', record.projectName, 'with recording ID:', record.id);
                window.location.href = '/editor/cruising';
              }}
              data-testid={`button-resume-editing-${record.id}`}
            >
              <Edit3 className="w-3 h-3 mr-2" />
              Resume Editing
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
