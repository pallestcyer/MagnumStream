import React, { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";

interface TimeDataPoint {
  hour: number;
  sales: number;
  total: number;
  revenue: number;
  conversion: number;
}

interface DayDataPoint {
  day: string;
  sales: number;
  total: number;
  revenue: number;
  conversion: number;
}

interface AnalyticsData {
  timeAnalysis: TimeDataPoint[];
  dayOfWeekAnalysis: DayDataPoint[];
}

export default function TimeAnalysis() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics-time", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const timeData = analytics?.timeAnalysis || [];
  const dayData = analytics?.dayOfWeekAnalysis || [];

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

        <Card className="border border-border rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Hourly Performance (8 AM - 6 PM)</CardTitle>
            <CardDescription>Conversion rate trends throughout the day</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {timeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData}>
                  <defs>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" tickFormatter={(val) => `${val}:00`} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelFormatter={(val) => `${val}:00 - ${Number(val)+1}:00`}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Conversion Rate"]}
                  />
                  <Area type="monotone" dataKey="conversion" stroke="hsl(var(--chart-1))" strokeWidth={3} fillOpacity={1} fill="url(#colorConv)" name="Conversion Rate %" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No hourly data available</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-border rounded-[32px]">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-muted-foreground">Day of Week Revenue</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-3))" name="Revenue" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No day data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border rounded-[32px]">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-muted-foreground">Conversion by Day</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" unit="%" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Conversion Rate"]}
                    />
                    <Bar dataKey="conversion" fill="hsl(var(--chart-2))" name="Conversion %" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No day data available</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
