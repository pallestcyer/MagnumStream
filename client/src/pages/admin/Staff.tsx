import React, { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Trophy, DollarSign, Layers, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";

interface StaffMember {
  name: string;
  revenue: number;
  combos: number;
  videos: number;
  photos: number;
  totalSales: number;
}

interface AnalyticsData {
  staffData: StaffMember[];
  groundCrewData: StaffMember[];
  pilotData: StaffMember[];
  totalRevenue: number;
}

export default function Staff() {
  const [activeTab, setActiveTab] = useState<"pilot" | "groundCrew">("groundCrew");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics-staff", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  // Format name: replace underscores with spaces and capitalize each word
  const formatName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Transform staffData into the format needed for the charts based on selected tab
  const staffData = React.useMemo(() => {
    // Use pilotData for Pilots tab, groundCrewData for Ground Crew tab
    const sourceData = activeTab === "pilot" ? analytics?.pilotData : analytics?.groundCrewData;
    if (!sourceData) return [];
    return sourceData.map(s => ({
      name: formatName(s.name),
      revenue: s.revenue,
      combos: s.combos,
      videos: s.videos,
      photos: s.photos,
      totalSales: s.totalSales,
      role: activeTab === "pilot" ? "Pilot" : "Ground Crew"
    })).sort((a, b) => b.revenue - a.revenue);
  }, [analytics?.pilotData, analytics?.groundCrewData, activeTab]);

  const totalRevenue = staffData.reduce((acc, curr) => acc + curr.revenue, 0);
  const mvp = staffData.length > 0 ? staffData[0] : null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

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
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {activeTab === "pilot" ? "Pilot Performance" : "Ground Crew Performance"}
            </h2>
            <p className="text-muted-foreground mt-1">Sales volume and revenue attribution per crew member.</p>
          </div>

          <div className="flex items-center gap-3 bg-card p-1 rounded-xl border border-border">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pilot" | "groundCrew")} className="w-auto">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50 rounded-lg p-1 h-auto">
                <TabsTrigger value="pilot" className="rounded-md px-4 py-1.5 text-sm">Pilots</TabsTrigger>
                <TabsTrigger value="groundCrew" className="rounded-md px-4 py-1.5 text-sm">Ground Crew</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="h-6 w-px bg-border mx-1" />

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className={cn("px-3 text-sm font-medium text-muted-foreground hover:text-foreground h-9")}>
                  <Filter className="mr-2 h-4 w-4" />
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
        </div>

        {/* High Level Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">MVP</p>
              <p className="text-2xl font-bold text-primary">{mvp?.name || "N/A"}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Main Chart: Stacked Bar */}
        <Card className="border border-border rounded-[32px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium text-muted-foreground">Sales Volume by Crew Member</CardTitle>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Combos</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Video</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Photos</div>
            </div>
          </CardHeader>
          <CardContent className="h-[400px] pt-4">
            {staffData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(val) => val.split(' ')[0]}
                    dy={10}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="photos" stackId="a" fill="#FACC15" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="videos" stackId="a" fill="#FB923C" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="combos" stackId="a" fill="#EA580C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No staff sales data available</div>
            )}
          </CardContent>
        </Card>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <MetricLeaderboardCard
            title="Revenue"
            icon={DollarSign}
            data={staffData.map(d => ({ ...d, value: d.revenue, label: `$${(d.revenue / 1000).toFixed(1)}k` }))}
            accentColor="text-indigo-400"
            borderColor="border-indigo-500/20"
          />

          <MetricLeaderboardCard
            title="Combos"
            icon={Layers}
            data={staffData.map(d => ({ ...d, value: d.combos, label: d.combos.toString() })).sort((a,b) => b.value - a.value)}
            accentColor="text-emerald-400"
            borderColor="border-emerald-500/20"
          />

          <MetricLeaderboardCard
            title="Photos"
            icon={ImageIcon}
            data={staffData.map(d => ({ ...d, value: d.photos, label: d.photos.toString() })).sort((a,b) => b.value - a.value)}
            accentColor="text-blue-400"
            borderColor="border-blue-500/20"
          />

          <MetricLeaderboardCard
            title="Videos"
            icon={Video}
            data={staffData.map(d => ({ ...d, value: d.videos, label: d.videos.toString() })).sort((a,b) => b.value - a.value)}
            accentColor="text-amber-400"
            borderColor="border-amber-500/20"
          />
        </div>
      </div>
    </AdminLayout>
  );
}

function MetricLeaderboardCard({ title, icon: Icon, data, accentColor, borderColor }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const topPerformer = data[0];
  const runnersUp = isExpanded ? data.slice(1) : data.slice(1, 5);

  const getInitials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const getRankBadgeColor = (index: number) => {
    if (index === 0) return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
    if (index === 1) return "bg-orange-500/10 text-orange-600 border-orange-200";
    return "bg-muted text-muted-foreground border-transparent";
  };

  return (
    <Card className={cn("border rounded-[28px] overflow-hidden flex flex-col h-fit transition-all duration-300 hover:shadow-lg hover:-translate-y-1", borderColor)}>
      <CardHeader className="pb-3 pt-5 px-6 flex flex-row items-center justify-between space-y-0 border-b border-border/40 bg-gradient-to-b from-background/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl bg-background shadow-sm border border-border/50", accentColor)}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-bold text-base">{title}</span>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col bg-gradient-to-b from-transparent via-background/20 to-background/40">
        {topPerformer && (
          <div className="px-6 py-6 flex flex-col items-center text-center border-b border-border/40 relative">
            <div className="absolute top-4 right-4">
              <div className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm border border-yellow-400">
                <Trophy className="w-3 h-3" /> #1
              </div>
            </div>

            <div className="relative mb-3 group cursor-pointer">
              <div className={cn("absolute -inset-1 rounded-full opacity-30 blur-md transition-opacity duration-500 group-hover:opacity-60", accentColor.replace('text-', 'bg-'))}></div>
              <Avatar className={cn("h-16 w-16 border-2 ring-4 ring-background z-10 relative shadow-xl", accentColor.replace('text-', 'border-'))}>
                <AvatarFallback className="bg-gradient-to-br from-muted to-background font-bold text-lg">{getInitials(topPerformer.name)}</AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg leading-tight text-yellow-600 dark:text-yellow-400">{topPerformer.name}</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium opacity-80">{topPerformer.role}</p>
            </div>

            <div className={cn("mt-3 text-2xl font-bold tracking-tight", accentColor)}>
              {topPerformer.label}
            </div>
          </div>
        )}

        <div className="flex-1 py-2 transition-all duration-500 ease-in-out">
          {runnersUp.map((p: any, i: number) => {
            const rank = i + 2;
            const isLast = i === runnersUp.length - 1;

            return (
              <div key={p.name} className={cn(
                "flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors cursor-default group",
                !isLast && "border-b border-border/30"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border", getRankBadgeColor(i))}>
                    {rank}
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border/60 shadow-sm">
                      <AvatarFallback className="text-[10px] bg-muted/80 font-medium">{getInitials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className={cn("font-semibold text-sm transition-colors", i < 2 ? "text-yellow-500" : "text-foreground")}>{p.name}</span>
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-sm opacity-90">{p.label}</div>
              </div>
            );
          })}

          {data.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8 italic">No data available</div>
          )}
        </div>

        {data.length > 5 && (
          <div className="p-3 border-t border-border/40 bg-background/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-8 rounded-xl"
            >
              {isExpanded ? "Show Less" : "View Full Ranking"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
