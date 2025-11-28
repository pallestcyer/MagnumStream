import { addDays, subDays, format, getHours, getDay } from "date-fns";

// --- Types ---

export type PackageType = "video_only" | "photos_only" | "combo" | null;

export interface Project {
  id: string;
  flightTime: string; // ISO string
  pilot: string;
  groundCrew?: string;
  customerNames: string[];
  email: string;
  videoCompleted: boolean;
  photosCompleted: boolean;
  packagePurchased: PackageType;
  saleAmount: number;
  createdAt: string;
  saleDate: string | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface FilterState {
  dateRange: DateRange;
  pilot: string | "all";
  packageType: PackageType | "all";
}

// --- Mock Data Generation ---

const PILOTS = [
  "Shawn Konzal",
  "Jeff Protocolo",
  "Herbert Rafol",
  "Jaedon Oliver",
  "Travis Bartholomew",
  "Josh LaBonte",
  "Tianna Castillo"
];
const GROUND_CREW = [
  "Kiana Machado",
  "Jessicha Kealoha",
  "Asa Nagata",
  "Kylen Malepeai",
  "Nelin Cadena",
  "Ian Mothered",
  "Rubi Guerra",
  "Kevin Pedersen"
];
const PACKAGES: PackageType[] = ["video_only", "photos_only", "combo", null];

// Helper to generate random data
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];

export const generateMockData = (count: number = 200): Project[] => {
  const projects: Project[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const daysAgo = randomInt(0, 60);
    const flightDate = subDays(now, daysAgo);
    // Randomize time of day (8am to 6pm)
    flightDate.setHours(randomInt(8, 18), randomInt(0, 59));

    const isPurchased = Math.random() > 0.3; // 70% conversion rate roughly
    let packageType: PackageType = null;
    let saleAmount = 0;
    let saleDate: string | null = null;

    if (isPurchased) {
      packageType = randomItem(["video_only", "photos_only", "combo"]);
      if (packageType === "video_only") saleAmount = 150;
      else if (packageType === "photos_only") saleAmount = 100;
      else if (packageType === "combo") saleAmount = 200;

      // Sale happens 0-5 days after flight
      const saleDelay = randomInt(0, 5);
      saleDate = addDays(flightDate, saleDelay).toISOString();
    }

    // Completion status
    const videoCompleted = Math.random() > 0.1; // 90% completion
    const photosCompleted = Math.random() > 0.05; // 95% completion

    projects.push({
      id: `proj-${i}`,
      flightTime: flightDate.toISOString(),
      pilot: randomItem(PILOTS),
      groundCrew: randomItem(GROUND_CREW),
      customerNames: [`Customer ${i}A`, `Customer ${i}B`],
      email: `customer${i}@example.com`,
      videoCompleted,
      photosCompleted,
      packagePurchased: packageType,
      saleAmount,
      createdAt: flightDate.toISOString(),
      saleDate,
    });
  }
  return projects;
};

// Singleton mock data store
export const MOCK_DATA = generateMockData(500);

// --- Analytics Service Functions ---

export const getFilteredData = (data: Project[], filters: FilterState) => {
  return data.filter((p) => {
    const flightDate = new Date(p.flightTime);
    const inDateRange =
      flightDate >= filters.dateRange.from && flightDate <= filters.dateRange.to;
    const pilotMatch = filters.pilot === "all" || p.pilot === filters.pilot;
    const packageMatch =
      filters.packageType === "all" || p.packagePurchased === filters.packageType;

    return inDateRange && pilotMatch && packageMatch;
  });
};

export const getKPIMetrics = (data: Project[]) => {
  const totalGroups = data.length;
  const sales = data.filter((p) => p.packagePurchased !== null);
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((acc, curr) => acc + curr.saleAmount, 0);
  const conversionRate = totalGroups > 0 ? (totalSales / totalGroups) * 100 : 0;
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const videoCompletionRate =
    (data.filter((p) => p.videoCompleted).length / totalGroups) * 100;
  const photoCompletionRate =
    (data.filter((p) => p.photosCompleted).length / totalGroups) * 100;

  return {
    totalRevenue,
    totalGroups,
    totalSales,
    conversionRate,
    avgOrderValue,
    videoCompletionRate,
    photoCompletionRate,
  };
};

export const getRevenueOverTime = (data: Project[]) => {
  // Aggregate by day
  const revenueByDay: Record<string, { date: string; revenue: number; video: number; photos: number; combo: number }> = {};

  data.forEach((p) => {
    if (!p.packagePurchased) return;
    const day = format(new Date(p.saleDate!), "yyyy-MM-dd");
    if (!revenueByDay[day]) {
      revenueByDay[day] = { date: day, revenue: 0, video: 0, photos: 0, combo: 0 };
    }
    revenueByDay[day].revenue += p.saleAmount;
    if (p.packagePurchased === "video_only") revenueByDay[day].video += p.saleAmount;
    if (p.packagePurchased === "photos_only") revenueByDay[day].photos += p.saleAmount;
    if (p.packagePurchased === "combo") revenueByDay[day].combo += p.saleAmount;
  });

  return Object.values(revenueByDay).sort((a, b) => a.date.localeCompare(b.date));
};

export const getPackageMix = (data: Project[]) => {
  const mix = {
    video_only: 0,
    photos_only: 0,
    combo: 0,
  };
  let totalRevenue = 0;

  data.forEach((p) => {
    if (p.packagePurchased === "video_only") mix.video_only++;
    if (p.packagePurchased === "photos_only") mix.photos_only++;
    if (p.packagePurchased === "combo") mix.combo++;
    if (p.packagePurchased) totalRevenue += p.saleAmount;
  });

  return [
    { name: "Video Only", value: mix.video_only, revenue: mix.video_only * 150 },
    { name: "Photos Only", value: mix.photos_only, revenue: mix.photos_only * 100 },
    { name: "Combo", value: mix.combo, revenue: mix.combo * 200 },
  ];
};

export const getTimeAnalysis = (data: Project[]) => {
  // Initialize hours 8-18
  const hours = Array.from({ length: 11 }, (_, i) => i + 8);
  const byHour = hours.map((h) => ({ hour: h, sales: 0, total: 0, revenue: 0 }));

  data.forEach((p) => {
    const h = getHours(new Date(p.flightTime));
    const bucket = byHour.find((b) => b.hour === h);
    if (bucket) {
      bucket.total++;
      if (p.packagePurchased) {
        bucket.sales++;
        bucket.revenue += p.saleAmount;
      }
    }
  });

  return byHour.map(b => ({
    ...b,
    conversion: b.total > 0 ? (b.sales / b.total) * 100 : 0
  }));
};

export const getDayOfWeekAnalysis = (data: Project[]) => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = days.map(d => ({ day: d, sales: 0, total: 0, revenue: 0 }));

  data.forEach((p) => {
    const d = getDay(new Date(p.flightTime));
    const bucket = byDay[d];
    if (bucket) {
      bucket.total++;
      if (p.packagePurchased) {
        bucket.sales++;
        bucket.revenue += p.saleAmount;
      }
    }
  });

  return byDay.map(b => ({
    ...b,
    conversion: b.total > 0 ? (b.sales / b.total) * 100 : 0
  }));
};

export const getPilotPerformance = (data: Project[]) => {
  const pilotStats: Record<string, { pilot: string; groups: number; sales: number; revenue: number; videoMissing: number; photosMissing: number }> = {};

  const activePilots = Array.from(new Set(data.map(p => p.pilot)));

  activePilots.forEach(pilot => {
    pilotStats[pilot] = { pilot, groups: 0, sales: 0, revenue: 0, videoMissing: 0, photosMissing: 0 };
  });

  data.forEach(p => {
    if (pilotStats[p.pilot]) {
      pilotStats[p.pilot].groups++;
      if (p.packagePurchased) {
        pilotStats[p.pilot].sales++;
        pilotStats[p.pilot].revenue += p.saleAmount;
      }
      if (!p.videoCompleted) pilotStats[p.pilot].videoMissing++;
      if (!p.photosCompleted) pilotStats[p.pilot].photosMissing++;
    }
  });

  return Object.values(pilotStats).map(s => ({
    ...s,
    conversion: s.groups > 0 ? (s.sales / s.groups) * 100 : 0
  }));
};

export const getGroundCrewPerformance = (data: Project[]) => {
    const crewStats: Record<string, { crew: string; groups: number; sales: number; revenue: number; videoMissing: number; photosMissing: number }> = {};

    const activeCrew = Array.from(new Set(data.map(p => p.groundCrew)));

    activeCrew.forEach(crew => {
      if(crew) {
        crewStats[crew] = { crew, groups: 0, sales: 0, revenue: 0, videoMissing: 0, photosMissing: 0 };
      }
    });

    data.forEach(p => {
      if (p.groundCrew && crewStats[p.groundCrew]) {
        crewStats[p.groundCrew].groups++;
        if (p.packagePurchased) {
          crewStats[p.groundCrew].sales++;
          crewStats[p.groundCrew].revenue += p.saleAmount;
        }
        if (!p.videoCompleted) crewStats[p.groundCrew].videoMissing++;
        if (!p.photosCompleted) crewStats[p.groundCrew].photosMissing++;
      }
    });

    return Object.values(crewStats).map(s => ({
      ...s,
      conversion: s.groups > 0 ? (s.sales / s.groups) * 100 : 0
    }));
  };

export const getMissingMediaStats = (data: Project[]) => {
  const missingVideo = data.filter(p => !p.videoCompleted).length;
  const missingPhotos = data.filter(p => !p.photosCompleted).length;
  const missingBoth = data.filter(p => !p.videoCompleted && !p.photosCompleted).length;

  // Calculate conversion rates for complete vs incomplete
  const completeProjects = data.filter(p => p.videoCompleted && p.photosCompleted);
  const incompleteProjects = data.filter(p => !p.videoCompleted || !p.photosCompleted);

  const completeConversion = completeProjects.length > 0
    ? (completeProjects.filter(p => p.packagePurchased).length / completeProjects.length) * 100
    : 0;

  const incompleteConversion = incompleteProjects.length > 0
    ? (incompleteProjects.filter(p => p.packagePurchased).length / incompleteProjects.length) * 100
    : 0;

  return {
    missingVideo,
    missingPhotos,
    missingBoth,
    completeConversion,
    incompleteConversion
  };
};

export const getCompletionBasedBehavior = (data: Project[]) => {
  // Categories: Both Complete, Video Missing, Photos Missing, Both Missing
  const categories = {
    both_complete: { total: 0, sales: 0 },
    video_missing: { total: 0, sales: 0 }, // Photos complete but video missing
    photos_missing: { total: 0, sales: 0 }, // Video complete but photos missing
    both_missing: { total: 0, sales: 0 }
  };

  data.forEach(p => {
    if (p.videoCompleted && p.photosCompleted) {
      categories.both_complete.total++;
      if (p.packagePurchased) categories.both_complete.sales++;
    } else if (!p.videoCompleted && p.photosCompleted) {
      categories.video_missing.total++;
      if (p.packagePurchased) categories.video_missing.sales++;
    } else if (p.videoCompleted && !p.photosCompleted) {
      categories.photos_missing.total++;
      if (p.packagePurchased) categories.photos_missing.sales++;
    } else {
      categories.both_missing.total++;
      if (p.packagePurchased) categories.both_missing.sales++;
    }
  });

  return [
    { name: "Both Complete", rate: categories.both_complete.total > 0 ? (categories.both_complete.sales / categories.both_complete.total) * 100 : 0 },
    { name: "Missing Video", rate: categories.video_missing.total > 0 ? (categories.video_missing.sales / categories.video_missing.total) * 100 : 0 },
    { name: "Missing Photos", rate: categories.photos_missing.total > 0 ? (categories.photos_missing.sales / categories.photos_missing.total) * 100 : 0 },
    { name: "Missing Both", rate: categories.both_missing.total > 0 ? (categories.both_missing.sales / categories.both_missing.total) * 100 : 0 },
  ];
};

export const getDetailedSankeyData = (data: Project[]) => {
  // Source Nodes
  const SRC_VIDEO_ONLY = "Video Only Available";
  const SRC_PHOTOS_ONLY = "Photos Only Available";
  const SRC_BOTH = "Both Available";
  const SRC_NEITHER = "Neither Available";

  // Target Nodes
  const TGT_VIDEO = "Video Bought";
  const TGT_PHOTOS = "Photos Bought";
  const TGT_COMBO = "Combo Bought";
  const TGT_NONE = "No Purchase";

  const links: Record<string, number> = {};
  const incrementLink = (from: string, to: string) => {
    const key = `${from}|${to}`;
    links[key] = (links[key] || 0) + 1;
  };

  data.forEach(p => {
    // Determine Source
    let source = SRC_NEITHER;
    if (p.videoCompleted && p.photosCompleted) source = SRC_BOTH;
    else if (p.videoCompleted) source = SRC_VIDEO_ONLY;
    else if (p.photosCompleted) source = SRC_PHOTOS_ONLY;

    // Determine Target
    let target = TGT_NONE;
    if (p.packagePurchased === "video_only") target = TGT_VIDEO;
    else if (p.packagePurchased === "photos_only") target = TGT_PHOTOS;
    else if (p.packagePurchased === "combo") target = TGT_COMBO;

    incrementLink(source, target);
  });

  // Convert to Google Charts format: [From, To, Weight]
  return Object.entries(links).map(([key, weight]) => {
    const [from, to] = key.split("|");
    return [from, to, weight];
  });
};

export const getAvailabilityPathData = (data: Project[]) => {
  const categories = {
    both: {
      name: "Both Available",
      total: 0,
      outcomes: { no_purchase: 0, combo: 0, video: 0, photos: 0 }
    },
    photos_only: {
      name: "Photos Only Available",
      total: 0,
      outcomes: { no_purchase: 0, combo: 0, video: 0, photos: 0 }
    },
    video_only: {
      name: "Video Only Available",
      total: 0,
      outcomes: { no_purchase: 0, combo: 0, video: 0, photos: 0 }
    }
  };

  data.forEach(p => {
    let categoryKey: keyof typeof categories | "neither" = "neither";
    if (p.videoCompleted && p.photosCompleted) categoryKey = "both";
    else if (p.videoCompleted && !p.photosCompleted) categoryKey = "video_only";
    else if (!p.videoCompleted && p.photosCompleted) categoryKey = "photos_only";

    if (categoryKey === "neither") return;

    const cat = categories[categoryKey];
    cat.total++;

    if (!p.packagePurchased) cat.outcomes.no_purchase++;
    else if (p.packagePurchased === "combo") cat.outcomes.combo++;
    else if (p.packagePurchased === "video_only") cat.outcomes.video++;
    else if (p.packagePurchased === "photos_only") cat.outcomes.photos++;
  });

  // Transform to array with percentages
  return Object.entries(categories).map(([key, data]) => {
    let validOutcomes = [
      { label: "No Purchase", value: data.outcomes.no_purchase, color: "bg-muted" }
    ];

    if (key === "both") {
      validOutcomes.push(
        { label: "Combo Bought", value: data.outcomes.combo, color: "bg-emerald-500" },
        { label: "Video Bought", value: data.outcomes.video, color: "bg-amber-500" },
        { label: "Photos Bought", value: data.outcomes.photos, color: "bg-blue-500" }
      );
    } else if (key === "video_only") {
      validOutcomes.push(
        { label: "Video Bought", value: data.outcomes.video + data.outcomes.combo, color: "bg-amber-500" }
      );
    } else if (key === "photos_only") {
       validOutcomes.push(
        { label: "Photos Bought", value: data.outcomes.photos + data.outcomes.combo, color: "bg-blue-500" }
      );
    }

    const displayedTotal = validOutcomes.reduce((acc, curr) => acc + curr.value, 0);

    const outcomes = validOutcomes.map(o => ({
      ...o,
      percentage: displayedTotal > 0 ? (o.value / displayedTotal) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const totalSales = validOutcomes.filter(o => o.label !== "No Purchase").reduce((acc, curr) => acc + curr.value, 0);
    const conversionRate = displayedTotal > 0 ? (totalSales / displayedTotal) * 100 : 0;

    return {
      id: key,
      name: data.name,
      total: displayedTotal,
      conversionRate,
      outcomes
    };
  });
};

export const getDetailedStaffPerformance = (data: Project[], roleType: "pilot" | "groundCrew") => {
  const stats: Record<string, {
    name: string;
    role: string;
    revenue: number;
    combos: number;
    videos: number;
    photos: number;
    totalSales: number;
    totalGroups: number;
  }> = {};

  data.forEach(p => {
    const name = roleType === "pilot" ? p.pilot : p.groundCrew;
    if (!name) return;

    if (!stats[name]) {
      stats[name] = {
        name,
        role: roleType === "pilot" ? "Pilot" : "Ground Crew",
        revenue: 0,
        combos: 0,
        videos: 0,
        photos: 0,
        totalSales: 0,
        totalGroups: 0
      };
    }

    stats[name].totalGroups++;

    if (p.packagePurchased) {
      stats[name].totalSales++;
      stats[name].revenue += p.saleAmount;

      if (p.packagePurchased === "combo") stats[name].combos++;
      else if (p.packagePurchased === "video_only") stats[name].videos++;
      else if (p.packagePurchased === "photos_only") stats[name].photos++;
    }
  });

  return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
};

export const getIncompleteProjects = (data: Project[]) => {
  return data.filter(p => !p.videoCompleted || !p.photosCompleted).map(p => ({
    ...p,
    missingVideo: !p.videoCompleted,
    missingPhotos: !p.photosCompleted
  }));
};

export const getNonPurchasers = (data: Project[]) => {
  return data.filter(p => !p.packagePurchased || p.packagePurchased !== "combo").map(p => {
    let upsellOpportunity = "";
    let potentialValue = 0;

    if (!p.packagePurchased) {
      upsellOpportunity = "Full Combo";
      potentialValue = 200;
    } else if (p.packagePurchased === "video_only") {
      upsellOpportunity = "Add Photos";
      potentialValue = 50; // Upgrade to combo
    } else if (p.packagePurchased === "photos_only") {
      upsellOpportunity = "Add Video";
      potentialValue = 100; // Upgrade to combo
    }

    return {
      ...p,
      upsellOpportunity,
      potentialValue
    };
  });
};
