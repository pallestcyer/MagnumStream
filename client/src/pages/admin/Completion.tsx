import React, { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { AlertTriangle, ImageOff, VideoOff, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { type DateRange } from "react-day-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

interface IncompleteProject {
  id: string;
  flightDate: string | null;
  flightTime: string | null;
  customerNames: string[];
  email: string;
  pilot: string;
  groundCrew: string;
  videoCompleted: boolean;
  photosCompleted: boolean;
  packagePurchased: string | null;
}

interface AnalyticsData {
  missingVideo: number;
  missingPhotos: number;
  missingBoth: number;
  incompleteProjects: IncompleteProject[];
}

export default function Completion() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics-completion", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const stats = {
    missingVideo: analytics?.missingVideo || 0,
    missingPhotos: analytics?.missingPhotos || 0,
    missingBoth: analytics?.missingBoth || 0,
  };

  const incompleteProjects = analytics?.incompleteProjects || [];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-red-500 text-center p-8">Failed to load analytics data</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal rounded-full border-border hover:bg-accent hover:text-foreground", !dateRange && "text-muted-foreground")}>
                <Filter className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                      {format(dateRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range?.from && range?.to) {
                    setIsCalendarOpen(false);
                  }
                }}
                numberOfMonths={2}
                className="rounded-lg border shadow-sm"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-border rounded-[28px] bg-red-500/10 border-red-500/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-red-700 dark:text-red-200">Missing Video</p>
                <div className="text-3xl font-bold text-red-600 dark:text-red-500">{stats.missingVideo}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border rounded-[28px] bg-orange-500/10 border-orange-500/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <ImageOff className="w-6 h-6 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-200">Missing Photos</p>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">{stats.missingPhotos}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border rounded-[28px] bg-amber-500/10 border-amber-500/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-200">Missing Both</p>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">{stats.missingBoth}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Incomplete Projects List</CardTitle>
            <CardDescription>Action items: Projects that need media assets uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            {incompleteProjects.length > 0 ? (
              <Table>
                <TableHeader className="border-b border-border">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-muted-foreground">Date & Time</TableHead>
                    <TableHead className="text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-muted-foreground">Staff</TableHead>
                    <TableHead className="text-muted-foreground">Asset Status</TableHead>
                    <TableHead className="text-muted-foreground">Sale Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incompleteProjects.slice(0, 50).map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50 border-b border-border">
                      <TableCell className="font-mono text-sm text-foreground/80">
                        <div className="flex flex-col">
                          <span>{p.flightDate || "No date"}</span>
                          <span className="text-xs text-muted-foreground">{p.flightTime || "No time"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{p.customerNames[0]}</span>
                          {p.customerNames.length > 1 && (
                            <span className="text-xs text-muted-foreground">+{p.customerNames.length - 1} more</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-2">
                          <div className="relative group">
                            <Avatar className="h-8 w-8 border-2 border-red-500 ring-2 ring-background z-20" title={`Filmer: ${p.pilot}`}>
                              <AvatarFallback className="bg-red-100 text-red-700 text-xs font-bold">
                                {getInitials(p.pilot)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          {p.groundCrew && (
                            <div className="relative group">
                              <Avatar className="h-8 w-8 border-2 border-orange-500 ring-2 ring-background z-10" title={`Seller: ${p.groundCrew}`}>
                                <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-bold">
                                  {getInitials(p.groundCrew)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge
                            variant={p.videoCompleted ? "default" : "outline"}
                            className={cn(
                              "rounded-full px-3 transition-colors",
                              p.videoCompleted
                                ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600"
                                : "text-muted-foreground border-muted-foreground/30"
                            )}
                          >
                            Video
                          </Badge>

                          <Badge
                            variant={p.photosCompleted ? "default" : "outline"}
                            className={cn(
                              "rounded-full px-3 transition-colors",
                              p.photosCompleted
                                ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600"
                                : "text-muted-foreground border-muted-foreground/30"
                            )}
                          >
                            Photos
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.packagePurchased ? <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 rounded-full">Purchased</Badge> : <span className="text-muted-foreground text-sm">No Sale</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No incomplete projects found</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
