import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  Video, 
  ExternalLink, 
  CheckCircle2,
  ShoppingCart,
  Users,
  Clock,
  BarChart3,
  Search,
  Calendar,
  Lock,
  Unlock
} from "lucide-react";
import type { FlightRecording } from "@shared/schema";
import { BUNDLE_OPTIONS } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VideoPreview from "@/components/VideoPreview";

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState("front-desk");
  const [selectedRecording, setSelectedRecording] = useState<FlightRecording | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [selectedBundle, setSelectedBundle] = useState("video_photos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [analyticsPassword, setAnalyticsPassword] = useState("");
  const [isAnalyticsUnlocked, setIsAnalyticsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const { toast } = useToast();

  const ANALYTICS_PASSWORD = "admin123";

  // Check Google Drive authentication status
  const { data: driveAuthStatus } = useQuery({
    queryKey: ["/api/drive/auth/status"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/drive/auth/status");
      } catch (error) {
        return { authenticated: false };
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleAuthenticateDrive = async () => {
    try {
      const response = await apiRequest("GET", "/api/drive/auth/url");
      window.open(response.authUrl, '_blank', 'width=600,height=700');

      // Poll for auth status
      const checkInterval = setInterval(async () => {
        const status = await apiRequest("GET", "/api/drive/auth/status");
        if (status.authenticated) {
          clearInterval(checkInterval);
          queryClient.invalidateQueries({ queryKey: ["/api/drive/auth/status"] });
          toast({
            title: "Google Drive Connected",
            description: "You can now share videos with customers automatically",
          });
        }
      }, 2000);

      // Stop checking after 5 minutes
      setTimeout(() => clearInterval(checkInterval), 300000);
    } catch (error) {
      toast({
        title: "Authentication Failed",
        description: "Could not initiate Google Drive authentication",
        variant: "destructive",
      });
    }
  };

  // Fetch recordings with optional date filter
  const queryKey = selectedDate ? ["/api/recordings", { date: selectedDate }] : ["/api/recordings"];
  const { data: recordings = [], isLoading: recordingsLoading } = useQuery<FlightRecording[]>({
    queryKey: queryKey as any,
    queryFn: async () => {
      const url = selectedDate ? `/api/recordings?date=${selectedDate}` : "/api/recordings";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch recordings");
      return res.json();
    },
  });

  // Fetch analytics
  const { data: analytics } = useQuery<{
    totalRecordings: number;
    totalSales: number;
    exportedRecordings: number;
    conversionRate: number;
    staffSales: Record<string, number>;
    totalRevenue: number;
    dailyBreakdown: Array<{ date: string; sales: number; revenue: number }>;
  }>({
    queryKey: ["/api/sales/analytics"],
    enabled: isAnalyticsUnlocked,
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return await apiRequest("POST", "/api/sales", saleData);
    },
    onSuccess: async (_, variables) => {
      // Try to share the Drive folder with customer email
      try {
        await apiRequest("POST", "/api/drive/share-folder", {
          recordingId: variables.recordingId,
          customerEmail: variables.customerEmail
        });
        console.log(`✅ Shared Drive folder with ${variables.customerEmail}`);
      } catch (error) {
        console.warn('Could not share Drive folder (OAuth may not be set up):', error);
        // Don't fail the sale if sharing fails - it's optional
      }

      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/analytics"] });
      toast({
        title: "Sale Recorded",
        description: "Video purchase confirmed and customer notified",
      });
      setSelectedRecording(null);
      setConfirmEmail("");
      setConfirmName("");
      setStaffMember("");
      setSelectedBundle("video_photos");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record sale",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsSold = (recording: FlightRecording) => {
    setSelectedRecording(recording);
    setConfirmEmail(recording.pilotEmail || "");
    setConfirmName(recording.pilotName || "");
    setStaffMember(recording.staffMember || "");
  };

  const handleConfirmSale = () => {
    if (!selectedRecording || !confirmEmail || !confirmName || !staffMember || !selectedBundle) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const bundle = BUNDLE_OPTIONS.find(b => b.value === selectedBundle);
    
    createSaleMutation.mutate({
      recordingId: selectedRecording.id,
      customerName: confirmName,
      customerEmail: confirmEmail,
      staffMember: staffMember,
      bundle: selectedBundle,
      saleAmount: bundle?.price || 0,
      driveShared: false,
    });
  };

  const handleUnlockAnalytics = () => {
    if (passwordInput === ANALYTICS_PASSWORD) {
      setIsAnalyticsUnlocked(true);
      setPasswordInput("");
      toast({
        title: "Access Granted",
        description: "Analytics unlocked successfully",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive",
      });
    }
  };

  // Filter recordings by search query
  const filteredRecordings = recordings.filter(r => 
    r.pilotName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.pilotEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show recordings that are completed AND have a real Google Drive folder URL
  // This filters out recordings with only search URLs and shows only those with proper folder links
  const exportedRecordings = filteredRecordings.filter(r =>
    r.exportStatus === "completed" && r.driveFolderUrl
  );
  const unsoldRecordings = exportedRecordings.filter(r => !r.sold);
  const soldRecordings = exportedRecordings.filter(r => r.sold);

  // Get today's date for the date picker default
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage video sales and track performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg px-4 py-2">
              <DollarSign className="w-4 h-4 mr-2" />
              {unsoldRecordings.length} Available
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="front-desk" data-testid="tab-front-desk">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Front Desk
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Front Desk Tab */}
          <TabsContent value="front-desk" className="space-y-6 mt-6">
            {/* Search and Date Filter */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                  data-testid="input-date-filter"
                />
                {selectedDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate("")}
                    data-testid="button-clear-date"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Unsold Videos */}
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Available for Sale ({unsoldRecordings.length})
                </h2>
              </div>
              
              {recordingsLoading ? (
                <p className="text-muted-foreground text-center py-12">Loading videos...</p>
              ) : unsoldRecordings.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Videos Available</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDate ? "No videos found for this date" : "All exported videos have been sold or no videos are ready yet"}
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unsoldRecordings.map((recording) => (
                    <VideoPreview
                      key={recording.id}
                      driveFileId={recording.driveFileId}
                      driveFileUrl={recording.driveFileUrl}
                      driveFolderUrl={recording.driveFolderUrl}
                      customerName={recording.pilotName}
                      flightDate={recording.flightDate || 'Unknown date'}
                      flightTime={recording.flightTime || 'Unknown time'}
                      onSale={() => handleMarkAsSold(recording)}
                      showSaleButton={true}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Sold Videos */}
            {soldRecordings.length > 0 && (
              <Card className="p-6 bg-card/20 backdrop-blur-md border-card-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Sold Videos ({soldRecordings.length})
                  </h2>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {soldRecordings.map((recording) => (
                    <Card
                      key={recording.id}
                      className="p-4 bg-card/30 border-card-border opacity-75"
                      data-testid={`video-card-sold-${recording.id}`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{recording.pilotName}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{recording.projectName}</p>
                          </div>
                          <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
                            Sold
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>📅 {recording.flightDate} at {recording.flightTime}</p>
                          <p>👤 Staff: {recording.staffMember || "Unknown"}</p>
                        </div>

                        {(recording.driveFolderUrl || recording.driveFileUrl) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(recording.driveFolderUrl || recording.driveFileUrl!, '_blank')}
                            className="w-full"
                            data-testid={`button-view-sold-${recording.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 mt-6">
            {!isAnalyticsUnlocked ? (
              <Card className="p-12 bg-card/30 backdrop-blur-md border-card-border text-center">
                <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-4">Analytics Access Required</h2>
                <p className="text-muted-foreground mb-6">
                  Enter the password to view analytics dashboard
                </p>
                <div className="max-w-sm mx-auto space-y-4">
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlockAnalytics()}
                    data-testid="input-analytics-password"
                  />
                  <Button
                    onClick={handleUnlockAnalytics}
                    className="w-full bg-gradient-purple-blue"
                    data-testid="button-unlock-analytics"
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlock Analytics
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Key Metrics */}
                <div className="grid md:grid-cols-4 gap-6">
                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Filmed</p>
                        <h3 className="text-3xl font-bold text-foreground mt-1">
                          {analytics?.totalRecordings || 0}
                        </h3>
                      </div>
                      <Video className="w-10 h-10 text-primary/50" />
                    </div>
                  </Card>

                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sales</p>
                        <h3 className="text-3xl font-bold text-orange-500 mt-1">
                          {analytics?.totalSales || 0}
                        </h3>
                      </div>
                      <ShoppingCart className="w-10 h-10 text-orange-500/50" />
                    </div>
                  </Card>

                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Conversion Rate</p>
                        <h3 className="text-3xl font-bold text-foreground mt-1">
                          {analytics?.conversionRate?.toFixed(1) || 0}%
                        </h3>
                      </div>
                      <TrendingUp className="w-10 h-10 text-primary/50" />
                    </div>
                  </Card>

                  <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <h3 className="text-3xl font-bold text-foreground mt-1">
                          ${analytics?.totalRevenue?.toFixed(2) || 0}
                        </h3>
                      </div>
                      <DollarSign className="w-10 h-10 text-primary/50" />
                    </div>
                  </Card>
                </div>

                {/* Daily Breakdown */}
                <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                  <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Daily Sales Breakdown
                  </h2>
                  <div className="space-y-2">
                    {analytics?.dailyBreakdown && analytics.dailyBreakdown.length > 0 ? (
                      analytics.dailyBreakdown.map((day) => (
                        <div key={day.date} className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                          <div>
                            <p className="font-semibold text-foreground">{day.date}</p>
                            <p className="text-xs text-muted-foreground">{day.sales} sales</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-orange-500">${day.revenue.toFixed(2)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No sales data yet</p>
                    )}
                  </div>
                </Card>

                {/* Staff Performance */}
                <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                  <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Staff Performance
                  </h2>
                  <div className="space-y-3">
                    {analytics?.staffSales && Object.keys(analytics.staffSales).length > 0 ? (
                      Object.entries(analytics.staffSales as Record<string, number>)
                        .sort(([, a], [, b]) => b - a)
                        .map(([staff, count]) => (
                          <div key={staff} className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-purple-blue flex items-center justify-center text-white font-semibold">
                                {staff.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{staff}</p>
                                <p className="text-xs text-muted-foreground">{count} sales</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500/50">
                              {count} sold
                            </Badge>
                          </div>
                        ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No sales data yet</p>
                    )}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Purchase Confirmation Dialog */}
        <Dialog open={!!selectedRecording} onOpenChange={(open) => !open && setSelectedRecording(null)}>
          <DialogContent data-testid="dialog-confirm-purchase">
            <DialogHeader>
              <DialogTitle>Confirm Video Purchase</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="confirm-name">Customer Name</Label>
                <Input
                  id="confirm-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Customer full name"
                  data-testid="input-confirm-name"
                />
              </div>
              <div>
                <Label htmlFor="confirm-email">Customer Email</Label>
                <Input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="customer@example.com"
                  data-testid="input-confirm-email"
                />
              </div>
              <div>
                <Label htmlFor="staff-member">Staff Member</Label>
                <Input
                  id="staff-member"
                  value={staffMember}
                  onChange={(e) => setStaffMember(e.target.value)}
                  placeholder="Your name"
                  data-testid="input-staff-member"
                />
              </div>
              <div>
                <Label htmlFor="bundle-select">Bundle Selection</Label>
                <Select value={selectedBundle} onValueChange={setSelectedBundle}>
                  <SelectTrigger id="bundle-select" data-testid="select-bundle">
                    <SelectValue placeholder="Select a bundle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDLE_OPTIONS.map((bundle) => (
                      <SelectItem key={bundle.value} value={bundle.value} data-testid={`bundle-${bundle.value}`}>
                        {bundle.label} - ${bundle.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Price: ${BUNDLE_OPTIONS.find(b => b.value === selectedBundle)?.price || 0}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                This will mark the video as sold and add the customer email to the Google Drive folder for access.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedRecording(null)}
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSale}
                disabled={createSaleMutation.isPending}
                className="bg-gradient-purple-blue"
                data-testid="button-confirm-purchase"
              >
                {createSaleMutation.isPending ? "Processing..." : "Confirm Sale"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
