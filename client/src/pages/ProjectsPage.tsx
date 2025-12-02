import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePilot } from "@/contexts/PilotContext";
import { usePhotoUpload } from "@/contexts/PhotoUploadContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PILOTS, getPilotName, STAFF_MEMBERS, getStaffMemberName } from "@/lib/constants";

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
import { Plus, Clock, Plane, Mail, Video, Image, DollarSign, X, CheckCircle2, Edit3, PlayCircle, Upload, Trash2, ExternalLink, FileVideo, Play, Search, RotateCcw, Star, Archive, ArchiveRestore } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDevMode } from "@/contexts/DevModeContext";
import type { FlightRecording } from "@shared/schema";
import { BUNDLE_OPTIONS } from "@shared/schema";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setPilotInfo } = usePilot();
  const { startUpload } = usePhotoUpload();
  const { isDevMode } = useDevMode();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<FlightRecording | null>(null);
  const [saleProject, setSaleProject] = useState<FlightRecording | null>(null);
  // OLD IMPLEMENTATION - Two first names with "&" (commented out, kept for reference)
  // const [firstName1, setFirstName1] = useState("");
  // const [firstName2, setFirstName2] = useState("");
  const [firstName1, setFirstName1] = useState(""); // Keep for backward compatibility in edit mode
  const [firstName2, setFirstName2] = useState(""); // Keep for backward compatibility in edit mode

  // NEW INTAKE FORM FIELDS (MAGSAMPLE-style)
  const [fullName, setFullName] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [pilotName, setPilotName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [origin, setOrigin] = useState("");
  const [referral, setReferral] = useState("");
  const [purpose, setPurpose] = useState("");
  const [language, setLanguage] = useState("english");
  const [contactConsent, setContactConsent] = useState(false);
  const [waiverConsent, setWaiverConsent] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "sold" | "archived">("active");

  // Archive dialog state
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [projectToArchive, setProjectToArchive] = useState<FlightRecording | null>(null);

  // Sale dialog state
  const [saleEmails, setSaleEmails] = useState<string[]>([]);
  const [saleStaffMember, setSaleStaffMember] = useState("");
  const [selectedBundle, setSelectedBundle] = useState("video_photos");

  // Photos dialog state
  const [isPhotosDialogOpen, setIsPhotosDialogOpen] = useState(false);
  const [photosProject, setPhotosProject] = useState<FlightRecording | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null);

  // Sold project dialog state
  const [isSoldDialogOpen, setIsSoldDialogOpen] = useState(false);
  const [soldProject, setSoldProject] = useState<FlightRecording | null>(null);
  const [saleData, setSaleData] = useState<{
    id: string;
    customerEmail: string;
    staffMember: string;
    bundle: string;
    saleAmount: number;
    saleDate: string;
  } | null>(null);
  const [soldEmails, setSoldEmails] = useState<string[]>([""]);
  const [soldStaffMember, setSoldStaffMember] = useState("");
  const [soldBundle, setSoldBundle] = useState("");
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [isEditingSold, setIsEditingSold] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: projects = [], isLoading } = useQuery<FlightRecording[]>({
    queryKey: ["/api/recordings"],
    queryFn: async () => {
      const res = await fetch("/api/recordings");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    // Poll every 5 seconds to update render status
    refetchInterval: 5000,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Always refetch when component mounts (immediate status update)
    refetchOnMount: 'always',
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: {
      pilotName: string;
      pilotEmail: string;
      flightDate: string;
      flightTime: string;
      flightPilot: string;
      // New intake form fields
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
      customerEmails: string[];  // All emails for sharing
      staffMember: string;
      bundle: string;
      saleAmount: number;
      driveShared: boolean;
    }) => {
      return await apiRequest("POST", "/api/sales", saleData);
    },
    onSuccess: async (_, variables) => {
      // Try to share the Drive folder with ALL customer emails based on bundle type (via local Mac server)
      try {
        await fetch("http://localhost:3001/api/drive/share-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordingId: variables.recordingId,
            customerEmails: variables.customerEmails,  // Send all emails
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

  const updateSaleMutation = useMutation({
    mutationFn: async (data: {
      saleId: string;
      customerEmail?: string;
      staffMember?: string;
      bundle?: string;
      saleAmount?: number;
    }) => {
      return await apiRequest("PATCH", `/api/sales/${data.saleId}`, {
        customerEmail: data.customerEmail,
        staffMember: data.staffMember,
        bundle: data.bundle,
        saleAmount: data.saleAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Sale Updated",
        description: "The sale has been updated successfully.",
      });
      handleCloseSoldDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const archiveProjectMutation = useMutation({
    mutationFn: async ({ projectId, archived }: { projectId: string; archived: boolean }) => {
      return await apiRequest("PATCH", `/api/recordings/${projectId}`, { archived });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: variables.archived ? "Project Archived" : "Project Restored",
        description: variables.archived
          ? "The project has been moved to archives."
          : "The project has been restored to active projects.",
      });
      handleCloseArchiveDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenArchiveDialog = (project: FlightRecording) => {
    setProjectToArchive(project);
    setIsArchiveDialogOpen(true);
  };

  const handleCloseArchiveDialog = () => {
    setIsArchiveDialogOpen(false);
    setProjectToArchive(null);
  };

  const handleConfirmArchive = () => {
    if (projectToArchive) {
      archiveProjectMutation.mutate({
        projectId: projectToArchive.id,
        archived: !projectToArchive.archived, // Toggle archive state
      });
    }
  };

  const handleOpenCreateDialog = () => {
    // OLD IMPLEMENTATION reset (kept for backward compatibility)
    setFirstName1("");
    setFirstName2("");
    // NEW INTAKE FORM reset
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
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    // OLD IMPLEMENTATION reset
    setFirstName1("");
    setFirstName2("");
    // NEW INTAKE FORM reset
    setFullName("");
    setFlightDate("");
    setFlightTime("");
    setPilotName("");
    setEmail("");
    setPhone("");
    setOrigin("");
    setReferral("");
    setPurpose("");
    setLanguage("english");
    setContactConsent(false);
    setWaiverConsent(false);
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

    // Set default bundle based on what's available
    const hasVideo = project.exportStatus === 'completed';
    const hasPhotos = project.photosUploaded === true;
    if (hasVideo && hasPhotos) {
      setSelectedBundle("video_photos");
    } else if (hasVideo) {
      setSelectedBundle("video_only");
    } else {
      setSelectedBundle("photos_only");
    }

    setIsSaleDialogOpen(true);
  };

  const handleCloseSaleDialog = () => {
    setIsSaleDialogOpen(false);
    setSaleProject(null);
    setSaleEmails([]);
    setSaleStaffMember("");
    setSelectedBundle("video_photos");
  };

  const handleOpenSoldDialog = async (project: FlightRecording) => {
    setSoldProject(project);
    setIsSoldDialogOpen(true);
    setIsLoadingSale(true);

    try {
      const res = await fetch(`/api/sales/recording/${project.id}`);
      if (res.ok) {
        const sale = await res.json();
        setSaleData(sale);
        // Initialize with existing email, add empty slot for adding more
        setSoldEmails(sale.customerEmail ? [sale.customerEmail] : [""]);
        setSoldStaffMember(sale.staffMember || "");
        setSoldBundle(sale.bundle || "");
      }
    } catch (error) {
      console.error("Failed to fetch sale data:", error);
    } finally {
      setIsLoadingSale(false);
    }
  };

  const handleCloseSoldDialog = () => {
    setIsSoldDialogOpen(false);
    setSoldProject(null);
    setSaleData(null);
    setSoldEmails([""]);
    setSoldStaffMember("");
    setSoldBundle("");
    setIsEditingSold(false);
  };

  const handleUpdateSale = async () => {
    if (!saleData || !soldProject) return;

    const validEmails = soldEmails.filter((e) => e.trim());
    if (validEmails.length === 0) {
      toast({
        title: "Email Required",
        description: "Please enter at least one customer email.",
        variant: "destructive",
      });
      return;
    }

    const bundle = BUNDLE_OPTIONS.find((b) => b.value === soldBundle);

    // Update the sale with primary email
    updateSaleMutation.mutate({
      saleId: saleData.id,
      customerEmail: validEmails[0], // Primary email for the sale record
      staffMember: soldStaffMember,
      bundle: soldBundle,
      saleAmount: bundle?.price || saleData.saleAmount,
    });

    // Share Drive folder with all emails (via local Mac server)
    if (validEmails.length > 0) {
      try {
        await fetch("http://localhost:3001/api/drive/share-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordingId: soldProject.id,
            customerEmails: validEmails,
            bundle: soldBundle
          })
        });
      } catch (error) {
        console.warn('Could not share Drive folder:', error);
        // Don't fail if sharing fails
      }
    }
  };

  const handleRemoveSoldEmail = (index: number) => {
    setSoldEmails(soldEmails.filter((_, i) => i !== index));
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

    // Create a sale with primary email (first one) and share with ALL emails
    createSaleMutation.mutate({
      recordingId: saleProject.id,
      customerName: saleProject.pilotName,
      customerEmail: validEmails[0],
      customerEmails: validEmails,  // Pass all emails for Drive sharing
      staffMember: saleStaffMember,
      bundle: selectedBundle,
      saleAmount: bundle?.price || 0,
      driveShared: false,
    });
  };

  const handleCreateProject = () => {
    // NEW IMPLEMENTATION - Full name validation
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

    if (!waiverConsent) {
      toast({
        title: "Waiver Required",
        description: "You must accept the liability waiver to proceed.",
        variant: "destructive",
      });
      return;
    }

    // OLD IMPLEMENTATION (commented out, kept for reference)
    // const combinedName = firstName2.trim()
    //   ? `${firstName1.trim()} & ${firstName2.trim()}`
    //   : firstName1.trim();

    // NEW IMPLEMENTATION - Use full name and all intake form fields
    createProjectMutation.mutate({
      pilotName: fullName.trim(),
      pilotEmail: email.trim(),
      flightDate,
      flightTime,
      flightPilot: pilotName,
      // New intake form fields
      phone: phone.trim() || undefined,
      origin: origin.trim() || undefined,
      referral: referral.trim() || undefined,
      purpose: purpose || undefined,
      language: language,
      contactConsent: contactConsent,
      waiverConsent: waiverConsent,
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
    } else if (status === 'recorded' || status === 'in_progress') {
      // All scenes recorded OR already editing - go to editor
      setLocation('/editor/cruising');
    } else {
      // Any other status (partially recorded) - go to recording page to complete
      setLocation('/recording');
    }
  };

  const getVideoButtonInfo = (status: string | null) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Video Complete',
          icon: CheckCircle2,
          className: 'border-green-500/50 text-green-500 hover:bg-green-500/10',
        };
      case 'in_progress':
        return {
          label: 'Continue Video',
          icon: Edit3,
          className: 'border-orange-500/50 text-orange-500 hover:bg-orange-500/10',
        };
      case 'recorded':
        return {
          label: 'Edit Video',
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

  const handleRedoVideo = (project: FlightRecording) => {
    // Set up the session for re-editing a completed project
    // This uses existing recordings but allows re-editing slot positions
    videoStorage.setCurrentSession(project.pilotName, false); // false = not a new project, preserve data

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

    toast({
      title: "Re-editing Mode",
      description: "Opening editor to modify slot positions. Re-render to create a new version.",
    });

    // Navigate to the editor (cruising is first scene)
    setLocation('/editor/cruising');
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
    setSelectedThumbnailIndex(null);
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
    // Adjust thumbnail index if needed
    if (selectedThumbnailIndex !== null) {
      if (index === selectedThumbnailIndex) {
        // Removed the thumbnail photo - clear selection
        setSelectedThumbnailIndex(null);
      } else if (index < selectedThumbnailIndex) {
        // Removed a photo before the thumbnail - shift index down
        setSelectedThumbnailIndex(selectedThumbnailIndex - 1);
      }
    }
  };

  const handleUploadPhotos = () => {
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

    // Get the selected thumbnail file (if any)
    const thumbnailFile = selectedThumbnailIndex !== null ? uploadedPhotos[selectedThumbnailIndex] : undefined;

    // Start upload in background via context
    startUpload(
      photosProject.id,
      photosProject.pilotName || 'Unknown Project',
      [...uploadedPhotos], // Copy array to avoid mutation issues
      photosProject.driveFolderUrl,
      thumbnailFile
    );

    // Close dialog immediately - upload continues in background
    handleClosePhotosDialog();
  };

  // Filter projects based on search query
  const filterProjects = (projectList: FlightRecording[]) => {
    if (!searchQuery.trim()) return projectList;

    const query = searchQuery.toLowerCase();
    return projectList.filter((project) => {
      const matchesName = project.pilotName?.toLowerCase().includes(query);
      const matchesEmail = project.pilotEmail?.toLowerCase().includes(query);
      const matchesPilot = project.flightPilot?.toLowerCase().includes(query) ||
                           getPilotName(project.flightPilot || "").toLowerCase().includes(query);
      const matchesTime = project.flightTime?.includes(query);

      return matchesName || matchesEmail || matchesPilot || matchesTime;
    });
  };

  // Split projects into unsold (active), sold, and archived, then filter
  // Filter out archived from Active and Sold tabs
  const allUnsoldProjects = projects.filter((p) => !p.sold && !p.archived);
  const allSoldProjects = projects.filter((p) => p.sold && !p.archived);
  const allArchivedProjects = projects.filter((p) => p.archived);

  const unsoldProjects = filterProjects(allUnsoldProjects);
  const soldProjects = filterProjects(allSoldProjects);
  const archivedProjects = filterProjects(allArchivedProjects);

  const renderProjectCard = (project: FlightRecording, isSold: boolean = false, isArchived: boolean = false) => (
    <Card
      key={project.id}
      className={`p-4 bg-card/30 backdrop-blur-md border-card-border hover:bg-card/50 transition-colors cursor-pointer flex flex-col ${isSold ? 'opacity-75' : ''} ${isArchived ? 'opacity-60' : ''}`}
      onClick={() => isArchived ? handleOpenArchiveDialog(project) : (isSold ? handleOpenSoldDialog(project) : handleOpenEditDialog(project))}
    >
      <div className="flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate flex-1 mr-2">
            {project.pilotName}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {/* Archive button - only show in dev mode on non-archived projects */}
            {isDevMode && !isArchived && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                title="Archive project"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenArchiveDialog(project);
                }}
              >
                <Archive className="w-4 h-4" />
              </Button>
            )}
            {/* Restore button for archived projects */}
            {isArchived && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-green-500"
                title="Restore project"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenArchiveDialog(project);
                }}
              >
                <ArchiveRestore className="w-4 h-4" />
              </Button>
            )}
            {project.driveFolderUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(project.driveFolderUrl!, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
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
              const isCompleted = project.exportStatus === 'completed';
              // Shorter labels in dev mode to make room for redo button
              const videoLabel = isDevMode && isCompleted ? 'Video' : videoInfo.label;
              return (
                <div className="flex gap-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 min-w-0 ${videoInfo.className}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenVideo(project);
                    }}
                  >
                    <VideoIcon className="w-4 h-4 shrink-0 mr-1" />
                    <span className="truncate">{videoLabel}</span>
                  </Button>
                  {isDevMode && isCompleted && (() => {
                    // Check if project is older than 24 hours (source files may be deleted)
                    const createdAt = new Date(project.createdAt);
                    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
                    const isExpired = hoursOld > 24;

                    return (
                      <Button
                        variant="outline"
                        size="icon"
                        className={`h-8 w-8 shrink-0 ${isExpired ? 'opacity-40 cursor-not-allowed' : 'border-orange-500/50 text-orange-500 hover:bg-orange-500/10'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isExpired) {
                            handleRedoVideo(project);
                          }
                        }}
                        disabled={isExpired}
                        title={isExpired ? "Source files expired (24h+)" : "Re-edit video"}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    );
                  })()}
                </div>
              );
            })()}
            {(() => {
              const photosCompleted = project.photosUploaded;
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full min-w-0 ${photosCompleted ? 'border-green-500/50 text-green-500 hover:bg-green-500/10' : ''}`}
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
                    <CheckCircle2 className="w-4 h-4 shrink-0 mr-1" />
                  ) : (
                    <Image className="w-4 h-4 shrink-0 mr-1" />
                  )}
                  <span className="truncate">Photos</span>
                </Button>
              );
            })()}
          </div>
          <div className="flex justify-end items-center gap-2">
            {isSold ? (
              <>
                {project.soldBundle && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {project.soldBundle === 'video_photos' && (
                      <>
                        <Video className="w-4 h-4" />
                        <span className="text-xs">+</span>
                        <Image className="w-4 h-4" />
                      </>
                    )}
                    {project.soldBundle === 'video_only' && (
                      <Video className="w-4 h-4" />
                    )}
                    {project.soldBundle === 'photos_only' && (
                      <Image className="w-4 h-4" />
                    )}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-500 text-green-500 hover:bg-green-500/10 min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenSoldDialog(project);
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mr-1" />
                  <span className="truncate">Sold</span>
                </Button>
              </>
            ) : (() => {
              // Allow sale if video is complete OR photos have been uploaded
              const hasVideo = project.exportStatus === 'completed';
              const hasPhotos = project.photosUploaded === true;
              const canCreateSale = hasVideo || hasPhotos;
              return (
                <Button
                  size="sm"
                  variant="outline"
                  className={`min-w-0 ${canCreateSale ? "border-orange-500 text-orange-500 hover:bg-orange-500/10" : ""}`}
                  disabled={!canCreateSale}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canCreateSale) {
                      handleOpenSaleDialog(project);
                    }
                  }}
                >
                  <DollarSign className="w-4 h-4 shrink-0 mr-1" />
                  <span className="truncate">Create Sale</span>
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage your flight recording projects
          </p>
        </div>
        <div className="relative w-full sm:w-64 md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "sold" | "archived")} className="mb-6">
        <TabsList>
          <TabsTrigger value="active">
            Active ({allUnsoldProjects.length})
          </TabsTrigger>
          <TabsTrigger value="sold">
            Sold ({allSoldProjects.length})
          </TabsTrigger>
          {/* Archives tab - only show in dev mode */}
          {isDevMode && (
            <TabsTrigger value="archived">
              <Archive className="w-4 h-4 mr-1" />
              Archives ({allArchivedProjects.length})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Create New Project Card - only show on Active tab */}
        {activeTab === "active" && (
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
        )}

        {/* Projects based on active tab */}
        {isLoading ? (
          <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border min-h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading projects...</p>
          </Card>
        ) : activeTab === "active" ? (
          unsoldProjects.map((project) => renderProjectCard(project, false, false))
        ) : activeTab === "sold" ? (
          soldProjects.length > 0 ? (
            soldProjects.map((project) => renderProjectCard(project, true, false))
          ) : (
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border min-h-[200px] flex items-center justify-center col-span-full">
              <p className="text-muted-foreground">No sold projects yet</p>
            </Card>
          )
        ) : activeTab === "archived" ? (
          archivedProjects.length > 0 ? (
            archivedProjects.map((project) => renderProjectCard(project, project.sold || false, true))
          ) : (
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border min-h-[200px] flex items-center justify-center col-span-full">
              <p className="text-muted-foreground">No archived projects</p>
            </Card>
          )
        ) : null}
      </div>

      {/* Create Project Dialog - MAGSAMPLE-style Customer Intake Form */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Customer Intake Form</DialogTitle>
            <p className="text-sm text-muted-foreground">Please fill out the details below to help us customize your experience.</p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* OLD IMPLEMENTATION - First Names with "&" (commented out, kept for reference)
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
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
              <div className="text-2xl font-bold text-muted-foreground pb-3 hidden sm:block">
                &
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name-2">Second Name (Optional)</Label>
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
            */}

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name *</Label>
              <Input
                id="full-name"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Flight Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flight-date">Flight Date *</Label>
                <Input
                  id="flight-date"
                  type="date"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flight-time">Flight Time *</Label>
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
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
                <Label htmlFor="origin">Where are you from?</Label>
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
                <Label htmlFor="referral">How did you find Magnum?</Label>
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
                <Label htmlFor="purpose">What are you here for?</Label>
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
                <Label htmlFor="pilot-name">Pilot *</Label>
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
              <Label>Primary Language</Label>
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
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-secondary/30 p-2 sm:p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <span className="text-2xl sm:text-3xl mb-1">{lang.icon}</span>
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
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseDialog} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={createProjectMutation.isPending || !waiverConsent}
              className="bg-gradient-purple-blue hover:opacity-90 w-full sm:w-auto"
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First Names */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
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
              <div className="text-2xl font-bold text-muted-foreground pb-3 hidden sm:block">
                &
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-first-name-2">Second Name (Optional)</Label>
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseEditDialog} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProject}
              disabled={updateProjectMutation.isPending}
              className="bg-gradient-purple-blue hover:opacity-90 w-full sm:w-auto"
            >
              {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sale Dialog */}
      <Dialog open={isSaleDialogOpen} onOpenChange={setIsSaleDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              This will mark the project as sold and share the selected content with the customer email(s) via Google Drive.
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseSaleDialog} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSale}
              disabled={createSaleMutation.isPending}
              className="bg-gradient-purple-blue hover:opacity-90 w-full sm:w-auto"
            >
              {createSaleMutation.isPending ? "Processing..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photos Upload Dialog */}
      <Dialog open={isPhotosDialogOpen} onOpenChange={setIsPhotosDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center justify-between">
                  <Label>Selected Photos ({uploadedPhotos.length})</Label>
                  <span className="text-xs text-muted-foreground">Click star to set as thumbnail</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                  {uploadedPhotos.map((file, index) => (
                    <div
                      key={index}
                      className={`relative group cursor-pointer ${
                        selectedThumbnailIndex === index ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-background rounded-md' : ''
                      }`}
                      onClick={() => setSelectedThumbnailIndex(selectedThumbnailIndex === index ? null : index)}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-20 object-cover rounded-md"
                      />
                      {/* Thumbnail indicator */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedThumbnailIndex(selectedThumbnailIndex === index ? null : index);
                        }}
                        className={`absolute top-1 left-1 p-1 rounded-full transition-all ${
                          selectedThumbnailIndex === index
                            ? 'bg-yellow-500 opacity-100'
                            : 'bg-black/50 opacity-0 group-hover:opacity-100'
                        }`}
                        title={selectedThumbnailIndex === index ? 'Remove as thumbnail' : 'Set as thumbnail'}
                      >
                        <Star className={`w-3 h-3 ${selectedThumbnailIndex === index ? 'text-white fill-white' : 'text-white'}`} />
                      </button>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(index);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {selectedThumbnailIndex === index ? 'Thumbnail' : file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleClosePhotosDialog} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleUploadPhotos}
              disabled={uploadedPhotos.length === 0}
              className="bg-gradient-purple-blue hover:opacity-90 w-full sm:w-auto"
            >
              Upload {uploadedPhotos.length > 0 ? `(${uploadedPhotos.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sold Project Details Dialog */}
      <Dialog open={isSoldDialogOpen} onOpenChange={setIsSoldDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Sale Details
              </DialogTitle>
              {saleData && !isEditingSold && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingSold(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingSale ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading sale details...</p>
              </div>
            ) : saleData ? (
              <>
                {/* Customer Info - Always shown */}
                {soldProject && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Customer</Label>
                    <p className="text-lg font-semibold">{soldProject.pilotName}</p>
                  </div>
                )}

                {/* Sale Date - Always shown */}
                {saleData.saleDate && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Sale Date</Label>
                    <p className="text-sm">
                      {new Date(saleData.saleDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}

                {isEditingSold ? (
                  /* EDIT MODE */
                  <>
                    {/* Customer Emails - Editable */}
                    <div className="space-y-2">
                      <Label>Customer Email(s)</Label>
                      <p className="text-xs text-muted-foreground">
                        Add emails to share the Drive folder with additional people
                      </p>
                      <div className="space-y-2">
                        {soldEmails.map((emailItem, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="customer@example.com"
                              value={emailItem}
                              onChange={(e) => {
                                const newEmails = [...soldEmails];
                                newEmails[index] = e.target.value;
                                setSoldEmails(newEmails);
                              }}
                              className="h-10"
                            />
                            {soldEmails.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleRemoveSoldEmail(index)}
                                className="h-10 w-10 shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            {index === soldEmails.length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setSoldEmails([...soldEmails, ""])}
                                className="h-10 w-10 shrink-0"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Member - Editable */}
                    <div className="space-y-2">
                      <Label htmlFor="sold-staff">Sold By</Label>
                      <Select value={soldStaffMember} onValueChange={setSoldStaffMember}>
                        <SelectTrigger id="sold-staff" className="h-10">
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

                    {/* Bundle Selection - Editable */}
                    <div className="space-y-2">
                      <Label htmlFor="sold-bundle">Bundle Purchased</Label>
                      <Select value={soldBundle} onValueChange={setSoldBundle}>
                        <SelectTrigger id="sold-bundle" className="h-10">
                          <SelectValue placeholder="Select bundle" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUNDLE_OPTIONS.map((bundle) => (
                            <SelectItem key={bundle.value} value={bundle.value}>
                              <span className="flex items-center gap-2">
                                {bundle.value === 'video_photos' && (
                                  <>
                                    <Video className="w-3 h-3" />
                                    <span>+</span>
                                    <Image className="w-3 h-3" />
                                  </>
                                )}
                                {bundle.value === 'video_only' && <Video className="w-3 h-3" />}
                                {bundle.value === 'photos_only' && <Image className="w-3 h-3" />}
                                {bundle.label} - ${bundle.price}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Price: ${BUNDLE_OPTIONS.find((b) => b.value === soldBundle)?.price || 0}
                      </p>
                    </div>
                  </>
                ) : (
                  /* VIEW MODE */
                  <>
                    {/* Customer Email - View */}
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Customer Email</Label>
                      <p className="text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {saleData.customerEmail || 'No email'}
                      </p>
                    </div>

                    {/* Staff Member - View */}
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Sold By</Label>
                      <p className="text-sm">
                        {getStaffMemberName(saleData.staffMember) || saleData.staffMember || 'Unknown'}
                      </p>
                    </div>

                    {/* Bundle - View */}
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Bundle Purchased</Label>
                      <div className="flex items-center gap-2">
                        {saleData.bundle === 'video_photos' && (
                          <span className="flex items-center gap-1 text-sm">
                            <Video className="w-4 h-4 text-blue-500" />
                            <span>+</span>
                            <Image className="w-4 h-4 text-green-500" />
                            Video + Photos
                          </span>
                        )}
                        {saleData.bundle === 'video_only' && (
                          <span className="flex items-center gap-1 text-sm">
                            <Video className="w-4 h-4 text-blue-500" />
                            Video Only
                          </span>
                        )}
                        {saleData.bundle === 'photos_only' && (
                          <span className="flex items-center gap-1 text-sm">
                            <Image className="w-4 h-4 text-green-500" />
                            Photos Only
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          (${BUNDLE_OPTIONS.find((b) => b.value === saleData.bundle)?.price || saleData.saleAmount})
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Drive Folder Link - Always shown */}
                {soldProject?.driveFolderUrl && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(soldProject.driveFolderUrl!, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Drive
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Sale data not found</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditingSold ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingSold(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateSale}
                  disabled={updateSaleMutation.isPending || !saleData}
                  className="bg-gradient-purple-blue hover:opacity-90 w-full sm:w-auto"
                >
                  {updateSaleMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleCloseSoldDialog} className="w-full sm:w-auto">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {projectToArchive?.archived ? (
                <>
                  <ArchiveRestore className="w-5 h-5 text-green-500" />
                  Restore Project
                </>
              ) : (
                <>
                  <Archive className="w-5 h-5 text-orange-500" />
                  Archive Project
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {projectToArchive && (
              <>
                <p className="text-foreground mb-4">
                  {projectToArchive.archived
                    ? "Are you sure you want to restore this project?"
                    : "Are you sure you want to archive this project?"}
                </p>
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="font-semibold text-foreground">{projectToArchive.pilotName}</p>
                  {projectToArchive.flightTime && (
                    <p className="text-sm text-muted-foreground">
                      Flight Time: {projectToArchive.flightTime}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {projectToArchive.archived
                    ? "The project will be moved back to the appropriate tab (Active or Sold)."
                    : "The project will be hidden from Active and Sold tabs but can be restored later from Archives."}
                </p>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseArchiveDialog} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmArchive}
              disabled={archiveProjectMutation.isPending}
              className={`w-full sm:w-auto ${
                projectToArchive?.archived
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {archiveProjectMutation.isPending
                ? "Processing..."
                : projectToArchive?.archived
                ? "Restore Project"
                : "Archive Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
