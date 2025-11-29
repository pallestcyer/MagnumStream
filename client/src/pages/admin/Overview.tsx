import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { subDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, Users, TrendingUp, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { type DateRange } from "react-day-picker";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

interface AnalyticsData {
  totalGroups: number;
  totalSales: number;
  totalRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  videoCompleted: number;
  photosCompleted: number;
  videoCompletionRate: number;
  photoCompletionRate: number;
  bundleCounts: {
    video_photos: number;
    video_only: number;
    photos_only: number;
  };
  bundleRevenue: {
    video_photos: number;
    video_only: number;
    photos_only: number;
  };
  packageMix: Array<{ name: string; value: number; revenue: number }>;
  missingVideo: number;
  missingPhotos: number;
  missingBoth: number;
  completeConversion: number;
  incompleteConversion: number;
  revenueOverTime: Array<{ date: string; revenue: number; flights: number; conversions: number; video: number; photos: number; combo: number }>;
  timeAnalysis: Array<{ hour: number; sales: number; total: number; revenue: number; conversion: number }>;
  dayOfWeekAnalysis: Array<{ day: string; sales: number; total: number; revenue: number; conversion: number }>;
  staffData: Array<{ name: string; revenue: number; combos: number; videos: number; photos: number; totalSales: number }>;
}

export default function Overview() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !analytics) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Failed to load analytics data</div>
        </div>
      </AdminLayout>
    );
  }

  const {
    totalGroups,
    totalSales,
    totalRevenue,
    conversionRate,
    avgOrderValue,
    videoCompleted,
    packageMix,
    missingVideo,
    missingPhotos,
    missingBoth,
    completeConversion,
    incompleteConversion,
    revenueOverTime,
    bundleCounts,
  } = analytics;

  return (
    <AdminLayout>
      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
        <div className="flex items-center gap-3 bg-card p-1 rounded-xl border border-border">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={cn("px-4 py-2 text-sm font-medium text-muted-foreground border-r border-border rounded-none h-auto hover:bg-transparent hover:text-foreground")}>
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="text-emerald-500 dark:text-emerald-400"
          bgColor="bg-emerald-500/10 dark:bg-emerald-400/10"
          chartData={revenueOverTime.slice(-10).map(d => ({ val: d.revenue }))}
        />
        <StatCard
          title="Total Groups"
          value={totalGroups.toString()}
          icon={Users}
          color="text-amber-500 dark:text-amber-400"
          bgColor="bg-amber-500/10 dark:bg-amber-400/10"
          chartData={revenueOverTime.slice(-10).map(d => ({ val: d.revenue * 0.5 }))}
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="text-orange-500 dark:text-orange-400"
          bgColor="bg-orange-500/10 dark:bg-orange-400/10"
          chartData={revenueOverTime.slice(-10).map(d => ({ val: d.revenue * 0.3 }))}
        />
        <StatCard
          title="Avg Order Value"
          value={`$${avgOrderValue.toFixed(2)}`}
          icon={ShoppingBag}
          color="text-yellow-600 dark:text-yellow-400"
          bgColor="bg-yellow-600/10 dark:bg-yellow-400/10"
          chartData={revenueOverTime.slice(-10).map(d => ({ val: d.revenue * 0.8 }))}
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2 border border-border rounded-[32px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">Revenue Analytics</CardTitle>
            <div className="text-3xl font-bold text-foreground">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            {revenueOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: any, name: string) => {
                      if (name === "Revenue") return [`$${value.toFixed(2)}`, name];
                      return [value, name];
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }}/>
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={false} name="Revenue" />
                  <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#f97316" strokeWidth={3} dot={false} name="Conversions" />
                  <Line yAxisId="right" type="monotone" dataKey="flights" stroke="#3b82f6" strokeWidth={3} dot={false} name="Flights" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No revenue data for selected period
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Sales Platform</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] relative">
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-3xl font-bold text-foreground">{totalSales}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Sales</span>
            </div>
            {packageMix.some(p => p.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {packageMix.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No sales data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border border-border rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <FunnelBar label="Total Groups" value={totalGroups} total={totalGroups} color="bg-muted" />
              <FunnelBar label="Media Completed" value={videoCompleted} total={totalGroups} color="bg-amber-500" />
              <FunnelBar label="Any Sale" value={totalSales} total={totalGroups} color="bg-orange-500" />
              <FunnelBar label="Combo Sale" value={bundleCounts.video_photos} total={totalGroups} color="bg-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border rounded-[32px] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-10 -mt-10"></div>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Missed Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-card p-4 rounded-2xl text-center border border-border">
                <div className="text-3xl font-bold text-red-500">{missingVideo}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Missing Video</div>
              </div>
              <div className="bg-card p-4 rounded-2xl text-center border border-border">
                <div className="text-3xl font-bold text-red-500">{missingPhotos}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Missing Photos</div>
              </div>
              <div className="bg-card p-4 rounded-2xl text-center border border-border">
                <div className="text-3xl font-bold text-red-500">{missingBoth}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Missing Both</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <span className="text-sm text-emerald-700 dark:text-emerald-200">Conversion (Complete Media)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{completeConversion.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <span className="text-sm text-red-700 dark:text-red-200">Conversion (Incomplete Media)</span>
                <span className="font-bold text-red-600 dark:text-red-400 text-lg">{incompleteConversion.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function StatCard({ title, value, icon: Icon, color, bgColor, chartData }: any) {
  return (
    <Card className="border border-border rounded-[28px] overflow-hidden relative group hover:-translate-y-1 transition-all duration-300">
      <CardContent className="p-6 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", bgColor, color)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">{title}</div>
          <div className="text-3xl font-bold text-foreground">{value}</div>
        </div>

        {/* Decorative Sparkline Background */}
        {chartData && chartData.length > 0 && (
          <div className="absolute bottom-0 right-0 w-1/2 h-16 opacity-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="val" stroke="currentColor" strokeWidth={4} dot={false} className={color} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="group">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-foreground font-bold">{value} <span className="text-xs text-muted-foreground font-normal ml-1">({percent}%)</span></span>
      </div>
      <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)] transition-all duration-1000 ease-out", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
