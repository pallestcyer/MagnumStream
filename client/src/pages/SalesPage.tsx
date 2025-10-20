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
  DollarSign, 
  TrendingUp, 
  Video, 
  ExternalLink, 
  CheckCircle2,
  ShoppingCart,
  Users,
  Clock,
  BarChart3
} from "lucide-react";
import type { FlightRecording } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState("front-desk");
  const [selectedRecording, setSelectedRecording] = useState<FlightRecording | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [saleAmount, setSaleAmount] = useState("49.99");
  const [staffMember, setStaffMember] = useState("");
  const { toast } = useToast();

  // Fetch recordings
  const { data: recordings = [], isLoading: recordingsLoading } = useQuery<FlightRecording[]>({
    queryKey: ["/api/recordings"],
  });

  // Fetch analytics
  const { data: analytics } = useQuery<{
    totalRecordings: number;
    totalSales: number;
    exportedRecordings: number;
    conversionRate: number;
    staffSales: Record<string, number>;
    totalRevenue: number;
  }>({
    queryKey: ["/api/sales/analytics"],
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return await apiRequest("POST", "/api/sales", saleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/analytics"] });
      toast({
        title: "Sale Recorded",
        description: "Video purchase confirmed and customer notified",
      });
      setSelectedRecording(null);
      setConfirmEmail("");
      setConfirmName("");
      setSaleAmount("49.99");
      setStaffMember("");
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
    if (!selectedRecording || !confirmEmail || !confirmName || !staffMember) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createSaleMutation.mutate({
      recordingId: selectedRecording.id,
      customerName: confirmName,
      customerEmail: confirmEmail,
      staffMember: staffMember,
      saleAmount: parseFloat(saleAmount) || 0,
    });
  };

  const exportedRecordings = recordings.filter(r => r.exportStatus === "completed");
  const availableRecordings = exportedRecordings.filter(r => !r.sold);

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
              {availableRecordings.length} Available
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
            <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">Available Videos for Purchase</h2>
              
              {recordingsLoading ? (
                <p className="text-muted-foreground text-center py-12">Loading videos...</p>
              ) : availableRecordings.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Videos Available</h3>
                  <p className="text-sm text-muted-foreground">
                    All exported videos have been sold or no videos are ready yet.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableRecordings.map((recording) => (
                    <Card
                      key={recording.id}
                      className="p-4 bg-card/50 border-card-border hover-elevate"
                      data-testid={`video-card-${recording.id}`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{recording.pilotName}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{recording.projectName}</p>
                          </div>
                          <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500/50">
                            New
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>📅 {recording.flightDate} at {recording.flightTime}</p>
                          <p>👤 Staff: {recording.staffMember || "Unknown"}</p>
                        </div>

                        <div className="flex gap-2">
                          {recording.driveFileUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(recording.driveFileUrl!, '_blank')}
                              className="flex-1"
                              data-testid={`button-preview-${recording.id}`}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Preview
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsSold(recording)}
                            className="flex-1 bg-gradient-purple-blue"
                            data-testid={`button-mark-sold-${recording.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Sold
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 mt-6">
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

            {/* Production Metrics */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Production Stats
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Videos Exported</span>
                    <span className="font-semibold text-foreground">{analytics?.exportedRecordings || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Available for Sale</span>
                    <span className="font-semibold text-foreground">{availableRecordings.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Already Sold</span>
                    <span className="font-semibold text-orange-500">{analytics?.totalSales || 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/30 backdrop-blur-md border-card-border">
                <h2 className="text-xl font-semibold text-foreground mb-4">Quick Insights</h2>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {analytics?.totalSales && analytics.totalSales > 0 ? (
                      <>✅ Great job! You've sold {analytics.totalSales} videos so far.</>
                    ) : (
                      <>📊 No sales yet. Start selling to see insights here!</>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {analytics?.conversionRate && analytics.conversionRate > 50 ? (
                      <>🎯 Excellent conversion rate of {analytics.conversionRate.toFixed(1)}%!</>
                    ) : (
                      <>💡 Conversion rate: {analytics?.conversionRate?.toFixed(1) || 0}%</>
                    )}
                  </p>
                </div>
              </Card>
            </div>
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
                <Label htmlFor="sale-amount">Sale Amount ($)</Label>
                <Input
                  id="sale-amount"
                  type="number"
                  step="0.01"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  placeholder="49.99"
                  data-testid="input-sale-amount"
                />
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
