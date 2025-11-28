import React, { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Video, Image as ImageIcon, Layers, Filter, AlertCircle, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { Chart } from "react-google-charts";

interface PackageMixItem {
  name: string;
  value: number;
  revenue: number;
}

interface OutcomeItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface AvailabilityPath {
  id: string;
  name: string;
  total: number;
  conversionRate: number;
  outcomes: OutcomeItem[];
}

interface AnalyticsData {
  packageMix: PackageMixItem[];
  availabilityPaths: AvailabilityPath[];
  sankeyData: [string, string, number][];
  totalGroups: number;
  totalSales: number;
}

export default function Packages() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics-packages", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const packageMix = analytics?.packageMix || [];
  const totalSales = packageMix.reduce((acc, curr) => acc + curr.value, 0);
  const packageMixWithPct = packageMix.map(p => ({
    ...p,
    percentage: totalSales > 0 ? (p.value / totalSales) * 100 : 0
  }));

  // Use availability paths directly from API
  const availabilityPaths = analytics?.availabilityPaths || [];

  // Sankey data for flow diagram
  const sankeyChartData = useMemo(() => {
    const rawData = analytics?.sankeyData || [];
    return [
      ["From", "To", "Weight"],
      ...rawData
    ];
  }, [analytics?.sankeyData]);

  // Sankey chart options with theme support
  const sankeyOptions = {
    sankey: {
      node: {
        colors: ["#34d399", "#fb923c", "#fbbf24", "#60a5fa", "#f87171", "#c084fc"],
        label: {
          fontName: 'Inter',
          fontSize: 13,
          color: '#94a3b8',
          bold: true
        },
        nodePadding: 20,
        width: 6,
        interactivity: true,
      },
      link: {
        colorMode: 'gradient',
        colors: ["#34d399", "#fb923c", "#fbbf24", "#60a5fa", "#f87171", "#c084fc"],
        fillOpacity: 0.5
      }
    },
    tooltip: {
      isHtml: true,
      textStyle: { fontName: 'Inter', fontSize: 13 }
    },
    backgroundColor: 'transparent',
  };

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold hidden">Packages Analysis</h2>
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

      <div className="space-y-8">
        {/* Section 1: Package Popularity */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-semibold text-foreground">Package Popularity</h3>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium">Based on Sold Packages</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart */}
            <Card className="border border-border rounded-[32px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-muted-foreground">Sales Mix</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {packageMixWithPct.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={packageMixWithPct}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {packageMixWithPct.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: any, name: string, props: any) => [`${value} (${props.payload.percentage.toFixed(1)}%)`, name]}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No sales data</div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Stats Cards */}
            <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {packageMixWithPct.length > 0 ? (
                packageMixWithPct.map((pkg, idx) => (
                  <Card key={pkg.name} className="border border-border rounded-[28px] flex flex-col justify-center relative overflow-hidden group hover:border-primary/50 transition-all">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      {idx === 0 && <Video className="w-32 h-32" />}
                      {idx === 1 && <ImageIcon className="w-32 h-32" />}
                      {idx === 2 && <Layers className="w-32 h-32" />}
                    </div>

                    <CardContent className="p-6 relative z-10">
                      <div className="mb-4 p-3 rounded-2xl bg-secondary w-fit">
                        {idx === 0 && <Video className="w-6 h-6 text-orange-500" />}
                        {idx === 1 && <ImageIcon className="w-6 h-6 text-yellow-500" />}
                        {idx === 2 && <Layers className="w-6 h-6 text-amber-600" />}
                      </div>
                      <h4 className="text-muted-foreground font-medium text-sm uppercase tracking-wider mb-1">{pkg.name}</h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{pkg.percentage.toFixed(1)}%</span>
                        <span className="text-sm text-muted-foreground">of sales</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Count</span>
                          <span className="font-medium">{pkg.value}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">${pkg.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3 flex items-center justify-center h-32 text-muted-foreground">No sales data available</div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Availability Paths */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Availability Paths</h3>
              <p className="text-sm text-muted-foreground">How media availability impacts purchasing decisions.</p>
            </div>
          </div>

          {availabilityPaths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availabilityPaths.map((path) => {
                let borderColor = "border-border";
                let bgColor = "bg-card";
                let iconColor = "text-muted-foreground";
                let Icon = AlertCircle;

                if (path.id === "both") {
                  borderColor = "border-emerald-500/30";
                  bgColor = "bg-emerald-500/5";
                  iconColor = "text-emerald-500";
                  Icon = Layers;
                } else if (path.id === "photos_only") {
                  borderColor = "border-blue-500/30";
                  bgColor = "bg-blue-500/5";
                  iconColor = "text-blue-500";
                  Icon = ImageIcon;
                } else if (path.id === "video_only") {
                  borderColor = "border-amber-500/30";
                  bgColor = "bg-amber-500/5";
                  iconColor = "text-amber-500";
                  Icon = Video;
                } else {
                  Icon = Ban;
                }

                return (
                  <Card key={path.id} className={cn("border rounded-[24px] overflow-hidden", borderColor, bgColor, path.id === "both" ? "md:col-span-2" : "")}>
                    <CardHeader className="pb-2 border-b border-border/50 bg-background/20">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3 items-center">
                          <div className={cn("p-2 rounded-xl bg-background border border-border/50 shadow-sm", iconColor)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold">{path.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{path.total.toLocaleString()} sessions started here</CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Conversion</div>
                          <div className={cn("text-xl font-bold", path.conversionRate > 50 ? "text-emerald-500" : path.conversionRate > 20 ? "text-amber-500" : "text-muted-foreground")}>
                            {path.conversionRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {path.outcomes.map((outcome) => (
                        <div key={outcome.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium flex items-center gap-2">
                              {outcome.label === "No Purchase" ? (
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                              ) : (
                                <CheckCircle2 className={cn("w-3 h-3",
                                  outcome.label.includes("Combo") ? "text-emerald-500" :
                                  outcome.label.includes("Video") ? "text-amber-500" : "text-blue-500"
                                )} />
                              )}
                              {outcome.label}
                            </span>
                            <span className="text-muted-foreground">{outcome.value.toLocaleString()} users</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 flex-1 bg-secondary/50 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", outcome.color)}
                                style={{ width: `${outcome.percentage}%` }}
                              />
                            </div>
                            <div className="w-12 text-right text-xs font-bold">{outcome.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}

                      <div className="pt-4 mt-2 flex justify-between items-center border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          {path.outcomes[0] && path.outcomes[0].percentage > 50 ? `Most users: ${path.outcomes[0].label}` : "Mixed outcomes"}
                        </span>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline">
                          Analyze Segments →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border border-border rounded-[24px] p-8 text-center">
              <p className="text-muted-foreground">No availability path data available. This data shows how media completion (video/photos) impacts customer purchasing behavior.</p>
            </Card>
          )}
        </section>

        {/* Section 3: Availability Impact Flow (Sankey Diagram) */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-semibold text-foreground">Availability Impact Flow</h3>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium">Media Availability → Customer Choice</span>
          </div>

          <Card className="border border-border rounded-[32px] overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium text-muted-foreground">Conversion Flow Analysis</CardTitle>
              <CardDescription>
                See exactly how media availability influences purchasing decisions.
                Flows move from <strong>Availability</strong> (left) to <strong>Outcome</strong> (right).
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[500px] p-0">
              {sankeyChartData.length > 1 ? (
                <div className="w-full h-full min-h-[450px] p-4">
                  <Chart
                    chartType="Sankey"
                    width="100%"
                    height="100%"
                    data={sankeyChartData}
                    options={sankeyOptions}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No flow data available. This chart shows how media availability impacts customer purchasing decisions.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AdminLayout>
  );
}
