import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  ExternalLink, 
  User, 
  FolderOpen,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface GoogleDriveAuthProps {
  onAuthSuccess?: (userInfo: any) => void;
  onUploadComplete?: (driveInfo: any) => void;
}

export default function GoogleDriveAuth({ onAuthSuccess, onUploadComplete }: GoogleDriveAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/google/auth-status');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUserInfo(data.userInfo);
          onAuthSuccess?.(data.userInfo);
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    try {
      // Get the Google OAuth URL from the server
      const response = await fetch('/api/google/auth-url');
      const { authUrl } = await response.json();
      
      // Open Google OAuth in a popup
      const popup = window.open(
        authUrl, 
        'google-auth', 
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the popup to close (user completed auth)
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setAuthLoading(false);
          // Check if authentication was successful
          setTimeout(checkAuthStatus, 1000);
        }
      }, 1000);

    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthLoading(false);
    }
  };

  const handleUploadToDrive = async () => {
    if (!isAuthenticated) {
      await handleGoogleAuth();
      return;
    }

    setUploadLoading(true);
    try {
      // Trigger video upload to user's Google Drive
      const pilotName = localStorage.getItem('currentSessionId') || 'Unknown_Customer';
      const response = await fetch('/api/google/upload-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: pilotName.replace(/_/g, ' '),
          fileName: `${pilotName}_Flight_Video.mp4`
        })
      });

      if (response.ok) {
        const driveInfo = await response.json();
        onUploadComplete?.(driveInfo);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/google/signout', { method: 'POST' });
      setIsAuthenticated(false);
      setUserInfo(null);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-blue-500" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connect Your Google Drive</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Authenticate with your Google account to save videos directly to your personal Drive
            </p>
          </div>

          <Button
            onClick={handleGoogleAuth}
            disabled={authLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {authLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect Google Drive
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            This will open Google's secure login page in a new window
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
      <div className="space-y-4">
        {/* Connected Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Google Drive Connected</h3>
              <p className="text-sm text-muted-foreground">
                Signed in as: {userInfo?.email || 'Loading...'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
            <User className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        </div>

        {/* Upload Action */}
        <div className="pt-4 border-t border-border">
          <Button
            onClick={handleUploadToDrive}
            disabled={uploadLoading}
            className="w-full bg-gradient-purple-blue"
          >
            {uploadLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Uploading to Your Drive...
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4 mr-2" />
                Save Video to My Drive
              </>
            )}
          </Button>
          
          <div className="flex justify-between items-center mt-3">
            <p className="text-xs text-muted-foreground">
              Video will be saved to your personal Google Drive
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}