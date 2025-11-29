import React, { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import { Mail, ArrowRight, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";

interface NonPurchaser {
  id: string;
  flightDate: string | null;
  flightTime: string | null;
  customerNames: string[];
  email: string;
  packagePurchased: string | null;
  videoCompleted: boolean;
  photosCompleted: boolean;
  upsellOpportunity: string;
  potentialValue: number;
}

interface AnalyticsData {
  nonPurchasers: NonPurchaser[];
  totalGroups: number;
  totalSales: number;
}

export default function NonPurchasers() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics-nonpurchasers", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const nonPurchasers = analytics?.nonPurchasers || [];

  const potentialRevenue = nonPurchasers.reduce((acc, p) => acc + (p.potentialValue || 49.99), 0);
  const totalOpportunities = nonPurchasers.length;
  const noPurchaseCount = nonPurchasers.filter(p => !p.packagePurchased).length;

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
        <div className="flex justify-end gap-3 mb-4">
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
          <Button variant="outline" className="rounded-full border-border hover:bg-accent hover:text-foreground"><Mail className="w-4 h-4 mr-2"/> Email List</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border rounded-[28px] bg-gradient-to-br from-card to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Opportunities</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold text-foreground">{totalOpportunities}</div></CardContent>
          </Card>
          <Card className="border border-border rounded-[28px] bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-200">Potential Revenue</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${potentialRevenue.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="border border-border rounded-[28px] bg-gradient-to-br from-card to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">No Purchase</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold text-foreground">{noPurchaseCount}</div></CardContent>
          </Card>
        </div>

        <Card className="border border-border rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Upsell Opportunity List</CardTitle>
            <CardDescription>Follow up with these customers to close the gap</CardDescription>
          </CardHeader>
          <CardContent>
            {nonPurchasers.length > 0 ? (
              <Table>
                <TableHeader className="border-b border-border">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-muted-foreground">Flight Date</TableHead>
                    <TableHead className="text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-muted-foreground">Current Status</TableHead>
                    <TableHead className="text-muted-foreground">Opportunity</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonPurchasers.slice(0, 50).map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50 border-b border-border group">
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{p.flightDate || "No date"}</span>
                          <span className="text-xs text-muted-foreground">{p.flightTime || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{p.customerNames[0]}</span>
                          <span className="text-xs text-muted-foreground">{p.email || "No email"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.packagePurchased === null ? (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80">
                            No Purchase
                          </Badge>
                        ) : p.packagePurchased === 'video_only' ? (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/30">
                            Bought Video
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/30">
                            Bought Photos
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm flex items-center gap-1">
                          {p.upsellOpportunity} <span className="opacity-50">(${p.potentialValue.toFixed(2)})</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No non-purchasers found in this date range</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
