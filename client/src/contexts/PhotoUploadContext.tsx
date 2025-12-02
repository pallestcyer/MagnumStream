import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface UploadJob {
  id: string;
  projectId: string;
  projectName: string;
  totalFiles: number;
  completedFiles: number;
  currentFileName: string;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

interface PhotoUploadContextType {
  uploadJobs: UploadJob[];
  startUpload: (projectId: string, projectName: string, files: File[], driveFolderUrl: string, thumbnailFile?: File) => Promise<void>;
  dismissJob: (jobId: string) => void;
  hasActiveUploads: boolean;
}

const PhotoUploadContext = createContext<PhotoUploadContextType | null>(null);

export function PhotoUploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const jobIdCounter = useRef(0);

  const updateJob = useCallback((jobId: string, updates: Partial<UploadJob>) => {
    setUploadJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, ...updates } : job
    ));
  }, []);

  // Helper to resize image and convert to base64 for thumbnail
  const resizeImageToBase64 = async (file: File, maxWidth: number = 640): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Convert to JPEG base64 with good quality
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(base64);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const startUpload = useCallback(async (
    projectId: string,
    projectName: string,
    files: File[],
    driveFolderUrl: string,
    thumbnailFile?: File
  ) => {
    const jobId = `upload-${++jobIdCounter.current}-${Date.now()}`;

    // Create new job
    const newJob: UploadJob = {
      id: jobId,
      projectId,
      projectName,
      totalFiles: files.length,
      completedFiles: 0,
      currentFileName: files[0]?.name || '',
      status: 'uploading'
    };

    setUploadJobs(prev => [...prev, newJob]);

    try {
      // Step 1: Get upload session (access token + folder ID)
      const sessionResponse = await fetch(`/api/recordings/${projectId}/photo-upload-session`);
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error || 'Failed to get upload session');
      }
      const session = await sessionResponse.json();
      const { photosFolderId, accessToken } = session;

      // Step 2: Upload each photo directly to Google Drive
      let uploadedCount = 0;
      const errors: { file: string; error: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateJob(jobId, {
          currentFileName: file.name,
          completedFiles: i
        });

        try {
          const metadata = {
            name: file.name,
            parents: [photosFolderId]
          };

          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', file);

          const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              body: form
            }
          );

          if (uploadResponse.ok) {
            uploadedCount++;
          } else {
            const errorText = await uploadResponse.text();
            errors.push({ file: file.name, error: errorText });
          }
        } catch (uploadError: any) {
          errors.push({ file: file.name, error: uploadError.message });
        }
      }

      // Step 3: Mark photos as uploaded in the database (and upload thumbnail if selected)
      if (uploadedCount > 0) {
        let thumbnailBase64: string | undefined;

        // If a thumbnail file was selected, resize and convert to base64
        if (thumbnailFile) {
          try {
            thumbnailBase64 = await resizeImageToBase64(thumbnailFile);
            console.log('📸 Thumbnail resized for upload');
          } catch (thumbnailError) {
            console.error('⚠️ Failed to process thumbnail:', thumbnailError);
          }
        }

        await fetch(`/api/recordings/${projectId}/photos-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadedCount, photosFolderId, thumbnailBase64 })
        });
      }

      // Update job status
      updateJob(jobId, {
        completedFiles: files.length,
        status: errors.length > 0 && uploadedCount === 0 ? 'error' : 'completed',
        errorMessage: errors.length > 0 ? `${errors.length} file(s) failed` : undefined
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/recordings'] });

      // Show toast
      toast({
        title: errors.length > 0 ? "Photos Partially Uploaded" : "Photos Uploaded",
        description: errors.length > 0
          ? `Uploaded ${uploadedCount}/${files.length} photo(s) for ${projectName}. ${errors.length} failed.`
          : `Successfully uploaded ${uploadedCount} photo(s) for ${projectName}.`,
        variant: errors.length > 0 && uploadedCount === 0 ? "destructive" : "default"
      });

      // Auto-dismiss completed jobs after 5 seconds
      setTimeout(() => {
        setUploadJobs(prev => prev.filter(j => j.id !== jobId));
      }, 5000);

    } catch (error: any) {
      updateJob(jobId, {
        status: 'error',
        errorMessage: error.message || 'Upload failed'
      });

      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || `Failed to upload photos for ${projectName}.`
      });
    }
  }, [toast, queryClient, updateJob]);

  const dismissJob = useCallback((jobId: string) => {
    setUploadJobs(prev => prev.filter(job => job.id !== jobId));
  }, []);

  const hasActiveUploads = uploadJobs.some(job => job.status === 'uploading');

  return (
    <PhotoUploadContext.Provider value={{ uploadJobs, startUpload, dismissJob, hasActiveUploads }}>
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUpload() {
  const context = useContext(PhotoUploadContext);
  if (!context) {
    throw new Error('usePhotoUpload must be used within a PhotoUploadProvider');
  }
  return context;
}
