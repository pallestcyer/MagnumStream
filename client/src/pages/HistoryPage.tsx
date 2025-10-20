import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PhaseNavigation from "@/components/PhaseNavigation";
import { 
  Calendar, 
  ExternalLink, 
  Download, 
  MessageSquare, 
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface ExportRecord {
  id: string;
  projectName: string;
  pilotName: string;
  flightDate: string;
  flightTime: string;
  exportDate: Date;
  status: "completed" | "failed" | "pending";
  driveUrl?: string;
  smsPhoneNumber?: string;
}

export default function HistoryPage() {

  // Mock data - in real app, this would come from API/database
  const [exportHistory] = useState<ExportRecord[]>([
    {
      id: "1",
      projectName: "Sunset Flight Tour",
      pilotName: "John Doe",
      flightDate: "2025-10-15",
      flightTime: "18:30",
      exportDate: new Date("2025-10-15T19:00:00"),
      status: "completed",
      driveUrl: "https://drive.google.com/file/d/abc123/view",
      smsPhoneNumber: "+1 (555) 123-4567",
    },
    {
      id: "2",
      projectName: "Mountain Pass Flight",
      pilotName: "Jane Smith",
      flightDate: "2025-10-14",
      flightTime: "14:00",
      exportDate: new Date("2025-10-14T14:30:00"),
      status: "completed",
      driveUrl: "https://drive.google.com/file/d/xyz789/view",
      smsPhoneNumber: "+1 (555) 987-6543",
    },
    {
      id: "3",
      projectName: "Coastal Tour",
      pilotName: "Mike Johnson",
      flightDate: "2025-10-13",
      flightTime: "10:00",
      exportDate: new Date("2025-10-13T10:45:00"),
      status: "completed",
      driveUrl: "https://drive.google.com/file/d/def456/view",
    },
  ]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusBadge = (status: ExportRecord['status']) => {
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
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhaseNavigation currentPhase="export" completedPhases={["info", "recording", "editing"]} />

      <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Export History</h1>
              <p className="text-muted-foreground">
                View all your past flight recordings and exports
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Exports</p>
                    <h3 className="text-3xl font-bold text-foreground mt-1">
                      {exportHistory.length}
                    </h3>
                  </div>
                  <Download className="w-10 h-10 text-primary/50" />
                </div>
              </Card>

              <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <h3 className="text-3xl font-bold text-green-500 mt-1">
                      {exportHistory.filter(e => e.status === "completed").length}
                    </h3>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-green-500/50" />
                </div>
              </Card>

              <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <h3 className="text-3xl font-bold text-foreground mt-1">
                    {exportHistory.filter(e => {
                      const exportMonth = e.exportDate.getMonth();
                      const currentMonth = new Date().getMonth();
                      return exportMonth === currentMonth;
                    }).length}
                  </h3>
                </div>
              </Card>
            </div>

            {/* Export Records List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Recent Exports</h2>

              {exportHistory.map((record) => (
                <Card
                  key={record.id}
                  className="p-6 bg-card/30 backdrop-blur-md border-card-border hover-elevate"
                  data-testid={`export-record-${record.id}`}
                >
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {record.projectName}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pilot: {record.pilotName}
                        </p>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>

                    {/* Details Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
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
                          <p className="text-xs text-muted-foreground">Exported On</p>
                          <p className="text-sm font-medium text-foreground">
                            {formatDate(record.exportDate)}
                          </p>
                        </div>
                      </div>

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
                    {record.status === "completed" && record.driveUrl && (
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
                  </div>
                </Card>
              ))}

              {exportHistory.length === 0 && (
                <Card className="p-12 bg-card/30 backdrop-blur-md border-card-border text-center">
                  <Download className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No exports yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your export history will appear here once you complete your first recording and export.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </main>
    </div>
  );
}
