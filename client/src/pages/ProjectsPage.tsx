import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePilot } from "@/contexts/PilotContext";
import { videoStorage } from "@/utils/videoStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PILOTS, getPilotName, STAFF_MEMBERS } from "@/lib/constants";

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
import { Plus, Clock, Plane, Mail, Video, Image, DollarSign, X, CheckCircle2, Edit3, PlayCircle, Upload, Trash2, ExternalLink, FileVideo, Play } from "lucide-react";
import type { FlightRecording } from "@shared/schema";
import { BUNDLE_OPTIONS } from "@shared/schema";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setPilotInfo } = usePilot();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<FlightRecording | null>(null);
  const [saleProject, setSaleProject] = useState<FlightRecording | null>(null);
  const [firstName1, setFirstName1] = useState("");
  const [firstName2, setFirstName2] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [pilotName, setPilotName] = useState("");
  const [email, setEmail] = useState("");

  // Sale dialog state
  const [saleEmails, setSaleEmails] = useState<string[]>([]);
  const [saleStaffMember, setSaleStaffMember] = useState("");
  const [selectedBundle, setSelectedBundle] = useState("video_photos");

  // Photos dialog state
  const [isPhotosDialogOpen, setIsPhotosDialogOpen] = useState(false);
  const [photosProject, setPhotosProject] = useState<FlightRecording | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: projects = [], isLoading } = useQuery<FlightRecording[]>({
    queryKey: ["/api/recordings"],
    queryFn: async () => {
      const res = await fetch("/api/recordings");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: {
      pilotName: string;
      pilotEmail: string;
      flightTime: string;
      flightPilot: string;
    }) => {
      // Create project in database (via Vercel API)
      const response = await apiRequest("POST", "/api/recordings", projectData);
      const project = await response.json();

      // Create Drive folder via local Mac server
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
      toast({
        title: "Project Created",
        description: "Your new project has been created successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (projectData: {
      id: string;
      pilotName: string;
      pilotEmail: string;
      flightTime: string;
      flightPilot: string;
    }) => {
      return await apiRequest("PATCH", `/api/recordings/${projectData.id}`, {
        pilotName: projectData.pilotName,
        pilotEmail: projectData.pilotEmail,
        flightTime: projectData.flightTime,
        flightPilot: projectData.flightPilot,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Project Updated",
        description: "Your project has been updated successfully.",
      });
      handleCloseEditDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markPhotosUploadedMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest("PATCH", `/api/recordings/${projectId}`, {
        photosUploaded: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update photos status.",
        variant: "destructive",
      });
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: {
      recordingId: string;
      customerName: string;
      customerEmail: string;
      staffMember: string;
      bundle: string;
      saleAmount: number;
      driveShared: boolean;
    }) => {
      return await apiRequest("POST", "/api/sales", saleData);
    },
    onSuccess: async (_, variables) => {
      // Try to share the Drive folder with customer email based on bundle type (via local Mac server)
      try {
        await fetch("http://localhost:3001/api/drive/share-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordingId: variables.recordingId,
            customerEmail: variables.customerEmail,
            bundle: variables.bundle
          })
        });
      } catch (error) {
        // Don't fail the sale if sharing fails - it's optional
      }

      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Sale Created",
        description: "The sale has been recorded successfully.",
      });
      handleCloseSaleDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateDialog = () => {
    setFirstName1("");
    setFirstName2("");
    setFlightTime(getRoundedTime());
    setPilotName("");
    setEmail("");
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setFirstName1("");
    setFirstName2("");
    setFlightTime("");
    setPilotName("");
    setEmail("");
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingProject(null);
    setFirstName1("");
    setFirstName2("");
    setFlightTime("");
    setPilotName("");
    setEmail("");
  };

  const handleOpenEditDialog = (project: FlightRecording) => {
    setEditingProject(project);
    // Parse the combined name back into first names
    const names = project.pilotName.split(" & ");
    setFirstName1(names[0] || "");
    setFirstName2(names[1] || "");
    setFlightTime(project.flightTime || "");
    setPilotName(project.flightPilot || "");
    setEmail(project.pilotEmail || "");
    setIsEditDialogOpen(true);
  };

  const handleOpenSaleDialog = (project: FlightRecording) => {
    setSaleProject(project);
    // Pre-populate with project email if exists
    if (project.pilotEmail) {
      setSaleEmails([project.pilotEmail]);
    } else {
      setSaleEmails([""]);
    }
    setSaleStaffMember("");
    setSelectedBundle("video_photos");
    setIsSaleDialogOpen(true);
  };

  const handleCloseSaleDialog = () => {
    setIsSaleDialogOpen(false);
    setSaleProject(null);
    setSaleEmails([]);
    setSaleStaffMember("");
    setSelectedBundle("video_photos");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setSaleEmails(saleEmails.filter((e) => e !== emailToRemove));
  };

  const handleConfirmSale = () => {
    const validEmails = saleEmails.filter((e) => e.trim());

    if (!saleProject || validEmails.length === 0 || !saleStaffMember || !selectedBundle) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including at least one email",
        variant: "destructive",
      });
      return;
    }

    const bundle = BUNDLE_OPTIONS.find((b) => b.value === selectedBundle);

    // Create a sale for the primary email (first one)
    createSaleMutation.mutate({
      recordingId: saleProject.id,
      customerName: saleProject.pilotName,
      customerEmail: validEmails[0],
      staffMember: saleStaffMember,
      bundle: selectedBundle,
      saleAmount: bundle?.price || 0,
      driveShared: false,
    });
  };

  const handleCreateProject = () => {
    if (!firstName1.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter at least the first customer name.",
        variant: "destructive",
      });
      return;
    }

    if (!flightTime) {
      toast({
        title: "Flight Time Required",
        description: "Please select a flight time.",
        variant: "destructive",
      });
      return;
    }

    if (!pilotName) {
      toast({
        title: "Pilot Required",
        description: "Please select a pilot.",
        variant: "destructive",
      });
      return;
    }

    const combinedName = firstName2.trim()
      ? `${firstName1.trim()} & ${firstName2.trim()}`
      : firstName1.trim();

    createProjectMutation.mutate({
      pilotName: combinedName,
      pilotEmail: email.trim(),
      flightTime,
      flightPilot: pilotName,
    });
  };

  const handleUpdateProject = () => {
    if (!editingProject) return;

    if (!firstName1.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter at least the first customer name.",
        variant: "destructive",
      });
      return;
    }

    if (!flightTime) {
      toast({
        title: "Flight Time Required",
        description: "Please select a flight time.",
        variant: "destructive",
      });
      return;
    }

    if (!pilotName) {
      toast({
        title: "Pilot Required",
        description: "Please select a pilot.",
        variant: "destructive",
      });
      return;
    }

    const combinedName = firstName2.trim()
      ? `${firstName1.trim()} & ${firstName2.trim()}`
      : firstName1.trim();

    updateProjectMutation.mutate({
      id: editingProject.id,
      pilotName: combinedName,
      pilotEmail: email.trim(),
      flightTime,
      flightPilot: pilotName,
    });
  };

  const getFlightTimeLabel = (value: string) => {
    if (!value) return value;
    // Convert "14:00" format to "2:00 PM" format
    const [hours, minutes] = value.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return value;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleOpenVideo = (project: FlightRecording) => {
    const status = project.exportStatus || 'pending';

    // Set up the session with project data
    // For resuming (recorded/in_progress/completed), pass false to preserve data
    const isNewProject = status === 'pending';
    videoStorage.setCurrentSession(project.pilotName, isNewProject);

    // Store in localStorage
    localStorage.setItem('pilotEmail', project.pilotEmail || '');
    localStorage.setItem('staffMember', project.staffMember || '');
    localStorage.setItem('currentRecordingId', project.id);

    // Update PilotContext
    setPilotInfo({
      name: project.pilotName,
      email: project.pilotEmail || '',
      staffMember: project.staffMember || '',
    });

    // Navigate based on status
    if (status === 'pending') {
      // Not yet recorded - go to recording page
      setLocation('/recording');
    } else if (status === 'completed' && project.videoFolderId) {
      // Completed - open Video subfolder in Drive directly
      window.open(`https://drive.google.com/drive/folders/${project.videoFolderId}`, '_blank');
    } else if (status === 'completed' && project.driveFolderUrl) {
      // Fallback to parent Drive folder if no video folder ID
      window.open(project.driveFolderUrl, '_blank');
    } else {
      // Recorded or in_progress - go to editor
      setLocation('/editor/cruising');
    }
  };

  const getVideoButtonInfo = (status: string | null) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Complete',
          icon: CheckCircle2,
          className: 'border-green-500/50 text-green-500 hover:bg-green-500/10',
        };
      case 'in_progress':
        return {
          label: 'Continue',
          icon: Edit3,
          className: 'border-orange-500/50 text-orange-500 hover:bg-orange-500/10',
        };
      case 'recorded':
        return {
          label: 'Edit',
          icon: PlayCircle,
          className: 'border-blue-500/50 text-blue-500 hover:bg-blue-500/10',
        };
      default:
        return {
          label: 'Video',
          icon: Video,
          className: '',
        };
    }
  };

  const handlePlayVideo = async (project: FlightRecording) => {
    try {
      // Get the local device URL for Mac service
      const healthResponse = await fetch('/api/health');
      let localDeviceUrl = '';

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        localDeviceUrl = healthData.services?.localDevice || '';
      }

      // Fallback to localhost in development
      if (!localDeviceUrl) {
        localDeviceUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
      }

      const apiUrl = localDeviceUrl || 'http://localhost:3001';

      // Call backend to open the local file in native player
      const response = await fetch(`${apiUrl}/api/recordings/open-local-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localVideoPath: project.localVideoPath || undefined,
          recordingId: project.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open video');
      }

      const result = await response.json();
      console.log('✅ Video opened in native player:', result.path);
    } catch (error) {
      console.error('Error opening video:', error);
      toast({
        title: "Error",
        description: "Failed to open video file. Please check the file exists locally on the Mac.",
        variant: "destructive",
      });
    }
  };

  const handleOpenPhotosDialog = (project: FlightRecording) => {
    setPhotosProject(project);
    setUploadedPhotos([]);
    setIsPhotosDialogOpen(true);
  };

  const handleClosePhotosDialog = () => {
    setIsPhotosDialogOpen(false);
    setPhotosProject(null);
    setUploadedPhotos([]);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );
    setUploadedPhotos((prev) => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith('image/')
      );
      setUploadedPhotos((prev) => [...prev, ...files]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const handleUploadPhotos = async () => {
    if (!photosProject || uploadedPhotos.length === 0) {
      toast({
        title: "No Photos",
        description: "Please add at least one photo to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!photosProject.driveFolderUrl) {
      toast({
        title: "No Drive Folder",
        description: "This project doesn't have a Google Drive folder. Please create the project with a pilot and flight time.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhotos(true);

    try {
      // Create FormData with all photos
      const formData = new FormData();
      uploadedPhotos.forEach((file) => {
        formData.append('photos', file);
      });

      // Upload photos to local Mac server (has Google Drive OAuth)
      const response = await fetch(`http://localhost:3001/api/recordings/${photosProject.id}/upload-photos`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload photos');
      }

      // Refresh the recordings list
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });

      toast({
        title: "Photos Uploaded",
        description: `Successfully uploaded ${result.uploaded} photo(s) to Google Drive.`,
      });
      handleClosePhotosDialog();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  // Split projects into unsold (active) and sold
  const unsoldProjects = projects.filter((p) => !p.sold);
  const soldProjects = projects.filter((p) => p.sold);

  const renderProjectCard = (project: FlightRecording, isSold: boolean = false) => (
    <Card
      key={project.id}
      className={`p-4 bg-card/30 backdrop-blur-md border-card-border hover:bg-card/50 transition-colors cursor-pointer flex flex-col ${isSold ? 'opacity-75' : ''}`}
      onClick={() => handleOpenEditDialog(project)}
    >
      <div className="flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate flex-1 mr-2">
            {project.pilotName}
          </h3>
          {project.driveFolderUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(project.driveFolderUrl!, '_blank');
              }}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="space-y-1 text-sm">
          {project.flightTime && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{getFlightTimeLabel(project.flightTime)}</span>
            </div>
          )}
          {project.flightPilot && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plane className="w-3 h-3" />
              <span>{getPilotName(project.flightPilot)}</span>
            </div>
          )}
          {project.pilotEmail && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span className="truncate">{project.pilotEmail}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-4 space-y-3">
          {/* Video Thumbnail - always show for consistent card height */}
          <div className={`aspect-video rounded-lg overflow-hidden relative group ${project.exportStatus === 'completed' && project.thumbnailUrl ? 'bg-muted' : ''}`}>
            {project.exportStatus === 'completed' && project.thumbnailUrl && (
              <>
                <img
                  src={project.thumbnailUrl}
                  alt={`${project.pilotName} Flight Video`}
                  className="w-full h-full object-cover"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="lg"
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayVideo(project);
                    }}
                  >
                    <Play className="w-6 h-6 text-white" />
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(() => {
              const videoInfo = getVideoButtonInfo(project.exportStatus);
              const VideoIcon = videoInfo.icon;
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full ${videoInfo.className}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenVideo(project);
                  }}
                >
                  <VideoIcon className="w-4 h-4 mr-1" />
                  {videoInfo.label}
                </Button>
              );
            })()}
            {(() => {
              const photosCompleted = project.photosUploaded;
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full ${photosCompleted ? 'border-green-500/50 text-green-500 hover:bg-green-500/10' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (photosCompleted && project.photosFolderId) {
                      // Photos uploaded - open Photos folder in Drive
                      window.open(`https://drive.google.com/drive/folders/${project.photosFolderId}`, '_blank');
                    } else {
                      handleOpenPhotosDialog(project);
                    }
                  }}
                >
                  {photosCompleted ? (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  ) : (
                    <Image className="w-4 h-4 mr-1" />
                  )}
                  {photosCompleted ? 'Complete' : 'Photos'}
                </Button>
              );
            })()}
          </div>
          {!isSold && (
            <div className="flex justify-end">
              {(() => {
                const canCreateSale = project.exportStatus === 'completed';
                return (
                  <Button
                    size="sm"
                    className={canCreateSale ? "bg-gradient-purple-blue hover:opacity-90" : ""}
                    variant={canCreateSale ? "default" : "outline"}
                    disabled={!canCreateSale}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canCreateSale) {
                        handleOpenSaleDialog(project);
                      }
                    }}
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    Create Sale
                  </Button>
                );
              })()}
            </div>
          )}
          {isSold && (
            <div className="flex justify-center">
              <span className="text-sm text-green-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Sold
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Manage your flight recording projects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Create New Project Card */}
        <Card
          className="p-6 bg-card/30 backdrop-blur-md border-card-border border-dashed cursor-pointer hover:bg-card/50 transition-colors flex flex-col items-center justify-center min-h-[200px]"
          onClick={handleOpenCreateDialog}
        >
          <div className="w-16 h-16 rounded-full bg-gradient-purple-blue flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">New Project</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Create a new flight recording project
          </p>
        </Card>

        {/* Active (Unsold) Projects */}
        {isLoading ? (
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border min-h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading projects...</p>
          </Card>
        ) : (
          unsoldProjects.map((project) => renderProjectCard(project, false))
        )}
      </div>

      {/* Sold Projects Section */}
      {!isLoading && soldProjects.length > 0 && (
        <>
          <div className="mb-4 mt-8">
            <h2 className="text-xl font-semibold text-foreground">Sold</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Completed sales ({soldProjects.length})
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {soldProjects.map((project) => renderProjectCard(project, true))}
          </div>
        </>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First Names */}
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
                />
              </div>
              <div className="text-2xl font-bold text-muted-foreground pb-3">
                &
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name-2">First Name (Optional)</Label>
                <Input
                  id="first-name-2"
                  type="text"
                  placeholder="John"
                  value={firstName2}
                  onChange={(e) => setFirstName2(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            {/* Flight Time */}
            <div className="space-y-2">
              <Label htmlFor="flight-time">
                Flight Time *
                <span className="text-xs text-muted-foreground ml-2">(auto-rounded to next hour/half-hour)</span>
              </Label>
              <Input
                id="flight-time"
                type="time"
                value={flightTime}
                onChange={(e) => setFlightTime(e.target.value)}
                className="h-12"
              />
            </div>

            {/* Pilot Name */}
            <div className="space-y-2">
              <Label htmlFor="pilot-name">Pilot Name *</Label>
              <Select value={pilotName} onValueChange={setPilotName}>
                <SelectTrigger id="pilot-name" className="h-12">
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

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={createProjectMutation.isPending}
              className="bg-gradient-purple-blue hover:opacity-90"
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First Names */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="edit-first-name-1">First Name *</Label>
                <Input
                  id="edit-first-name-1"
                  type="text"
                  placeholder="Emily"
                  value={firstName1}
                  onChange={(e) => setFirstName1(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="text-2xl font-bold text-muted-foreground pb-3">
                &
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-first-name-2">First Name (Optional)</Label>
                <Input
                  id="edit-first-name-2"
                  type="text"
                  placeholder="John"
                  value={firstName2}
                  onChange={(e) => setFirstName2(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            {/* Flight Time */}
            <div className="space-y-2">
              <Label htmlFor="edit-flight-time">Flight Time *</Label>
              <Input
                id="edit-flight-time"
                type="time"
                value={flightTime}
                onChange={(e) => setFlightTime(e.target.value)}
                className="h-12"
              />
            </div>

            {/* Pilot Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-pilot-name">Pilot Name *</Label>
              <Select value={pilotName} onValueChange={setPilotName}>
                <SelectTrigger id="edit-pilot-name" className="h-12">
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

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (Optional)</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProject}
              disabled={updateProjectMutation.isPending}
              className="bg-gradient-purple-blue hover:opacity-90"
            >
              {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sale Dialog */}
      <Dialog open={isSaleDialogOpen} onOpenChange={setIsSaleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Sale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Customer Name */}
            {saleProject && (
              <div>
                <Label>Customer Name</Label>
                <p className="text-lg font-medium text-foreground mt-1">
                  {saleProject.pilotName}
                </p>
              </div>
            )}

            {/* Customer Emails */}
            <div className="space-y-2">
              <Label>Customer Email(s) *</Label>

              {/* Email inputs */}
              <div className="space-y-2">
                {saleEmails.map((emailItem, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="customer@example.com"
                      value={emailItem}
                      onChange={(e) => {
                        const newEmails = [...saleEmails];
                        newEmails[index] = e.target.value;
                        setSaleEmails(newEmails);
                      }}
                      className="h-10"
                    />
                    {saleEmails.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveEmail(emailItem)}
                        className="h-10 w-10 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {index === saleEmails.length - 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSaleEmails([...saleEmails, ""])}
                        className="h-10 w-10 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Member */}
            <div>
              <Label htmlFor="sale-staff-member">Staff Member *</Label>
              <Select value={saleStaffMember} onValueChange={setSaleStaffMember}>
                <SelectTrigger id="sale-staff-member" className="h-12">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_MEMBERS.map((member) => (
                    <SelectItem key={member.value} value={member.value}>
                      {member.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bundle Selection */}
            <div>
              <Label htmlFor="sale-bundle-select">Bundle Selection *</Label>
              <Select value={selectedBundle} onValueChange={setSelectedBundle}>
                <SelectTrigger id="sale-bundle-select" className="h-12">
                  <SelectValue placeholder="Select a bundle" />
                </SelectTrigger>
                <SelectContent>
                  {BUNDLE_OPTIONS.map((bundle) => (
                    <SelectItem key={bundle.value} value={bundle.value}>
                      {bundle.label} - ${bundle.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Price: ${BUNDLE_OPTIONS.find((b) => b.value === selectedBundle)?.price || 0}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              This will mark the video as sold and add the customer email(s) to the Google Drive folder for access.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseSaleDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSale}
              disabled={createSaleMutation.isPending}
              className="bg-gradient-purple-blue hover:opacity-90"
            >
              {createSaleMutation.isPending ? "Processing..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photos Upload Dialog */}
      <Dialog open={isPhotosDialogOpen} onOpenChange={setIsPhotosDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Customer Name */}
            {photosProject && (
              <div>
                <Label>Project</Label>
                <p className="text-lg font-medium text-foreground mt-1">
                  {photosProject.pilotName}
                </p>
              </div>
            )}

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground font-medium mb-2">
                Drag and drop photos here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click the button below to select files
              </p>
              <input
                type="file"
                id="photo-upload"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("photo-upload")?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select Files
              </Button>
            </div>

            {/* Uploaded Photos Preview */}
            {uploadedPhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Photos ({uploadedPhotos.length})</Label>
                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                  {uploadedPhotos.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-20 object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClosePhotosDialog} disabled={isUploadingPhotos}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadPhotos}
              disabled={uploadedPhotos.length === 0 || isUploadingPhotos}
              className="bg-gradient-purple-blue hover:opacity-90"
            >
              {isUploadingPhotos ? "Uploading..." : `Upload ${uploadedPhotos.length > 0 ? `(${uploadedPhotos.length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
