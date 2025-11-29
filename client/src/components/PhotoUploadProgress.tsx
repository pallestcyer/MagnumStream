import { usePhotoUpload } from "@/contexts/PhotoUploadContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, AlertCircle, Upload, Loader2 } from "lucide-react";

export function PhotoUploadProgress() {
  const { uploadJobs, dismissJob } = usePhotoUpload();

  if (uploadJobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="max-w-md mx-auto space-y-2 pointer-events-auto">
        {uploadJobs.map((job) => {
          const progress = job.totalFiles > 0
            ? Math.round((job.completedFiles / job.totalFiles) * 100)
            : 0;

          return (
            <div
              key={job.id}
              className={`
                bg-card/95 backdrop-blur-lg border rounded-xl shadow-lg p-4
                animate-in slide-in-from-bottom-4 duration-300
                ${job.status === 'completed' ? 'border-green-500/50' : ''}
                ${job.status === 'error' ? 'border-red-500/50' : ''}
                ${job.status === 'uploading' ? 'border-primary/50' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${job.status === 'uploading' ? 'bg-primary/20' : ''}
                  ${job.status === 'completed' ? 'bg-green-500/20' : ''}
                  ${job.status === 'error' ? 'bg-red-500/20' : ''}
                `}>
                  {job.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  {job.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {job.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {job.status === 'uploading' && 'Uploading Photos'}
                      {job.status === 'completed' && 'Upload Complete'}
                      {job.status === 'error' && 'Upload Failed'}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-accent"
                      onClick={() => dismissJob(job.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {job.projectName}
                  </p>

                  {job.status === 'uploading' && (
                    <>
                      <div className="mt-2">
                        <Progress value={progress} className="h-1.5" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {job.completedFiles}/{job.totalFiles} - {job.currentFileName}
                      </p>
                    </>
                  )}

                  {job.status === 'completed' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {job.totalFiles} photo{job.totalFiles !== 1 ? 's' : ''} uploaded successfully
                    </p>
                  )}

                  {job.status === 'error' && job.errorMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
