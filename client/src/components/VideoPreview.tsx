import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Download, 
  ExternalLink, 
  Eye, 
  Clock,
  FileVideo,
  Users
} from "lucide-react";

interface VideoPreviewProps {
  driveFileId: string;
  driveFileUrl: string;
  customerName: string;
  flightDate: string;
  flightTime: string;
  onPreview?: () => void;
  onSale?: () => void;
  showSaleButton?: boolean;
  videoInfo?: {
    duration?: string;
    size?: number;
    thumbnailUrl?: string;
  };
}

export default function VideoPreview({
  driveFileId,
  driveFileUrl,
  customerName,
  flightDate,
  flightTime,
  onPreview,
  onSale,
  showSaleButton = true,
  videoInfo
}: VideoPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Generate Google Drive embed URL for preview
  const embedUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

  // Generate thumbnail URL from Drive file ID
  const thumbnailUrl = videoInfo?.thumbnailUrl || 
    `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1920-h1080`;

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (durationMs?: string): string => {
    if (!durationMs) return 'Unknown duration';
    const seconds = parseInt(durationMs) / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border hover-elevate">
        <div className="space-y-4">
          {/* Video Thumbnail/Preview */}
          <div className="relative group">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
              {!thumbnailError ? (
                <img 
                  src={thumbnailUrl}
                  alt={`${customerName} Flight Video Preview`}
                  className="w-full h-full object-cover"
                  onError={() => setThumbnailError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <FileVideo className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
              
              {/* Play Overlay */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  size="lg"
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <Play className="w-6 h-6 text-white" />
                </Button>
              </div>

              {/* Video Info Overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <Badge variant="secondary" className="bg-black/50 text-white border-none">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(videoInfo?.duration)}
                </Badge>
                <Badge variant="secondary" className="bg-black/50 text-white border-none">
                  {formatFileSize(videoInfo?.size)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Video Details */}
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                {customerName}
              </h3>
              <p className="text-sm text-muted-foreground">
                Flight on {flightDate} at {flightTime}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                className="flex-1"
              >
                <Eye className="w-3 h-3 mr-2" />
                Preview
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(driveFileUrl, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                View in Drive
              </Button>

              {showSaleButton && onSale && (
                <Button
                  size="sm"
                  onClick={onSale}
                  className="flex-1 bg-gradient-purple-blue"
                >
                  Create Sale
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Video Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{customerName} - Flight Video</h2>
                <p className="text-sm text-muted-foreground">
                  {flightDate} at {flightTime}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                ✕
              </Button>
            </div>
            
            <div className="aspect-video bg-black">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`${customerName} Flight Video`}
              />
            </div>
            
            <div className="p-4 border-t border-border flex justify-between items-center">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(videoInfo?.duration)}
                </span>
                <span>{formatFileSize(videoInfo?.size)}</span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(downloadUrl, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                
                {showSaleButton && onSale && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsPreviewOpen(false);
                      onSale();
                    }}
                    className="bg-gradient-purple-blue"
                  >
                    Create Sale
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}