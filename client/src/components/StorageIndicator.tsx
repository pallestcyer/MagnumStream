import { HardDrive } from "lucide-react";

interface StorageIndicatorProps {
  usedGB: number;
  totalGB: number;
}

export default function StorageIndicator({ usedGB, totalGB }: StorageIndicatorProps) {
  const percentage = (usedGB / totalGB) * 100;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card/50 backdrop-blur-md rounded-md border border-card-border">
      <HardDrive className="w-4 h-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Storage</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-foreground" data-testid="text-storage">
            {usedGB.toFixed(1)} GB
          </span>
          <span className="text-xs text-muted-foreground">/ {totalGB} GB</span>
        </div>
      </div>
      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-purple-blue transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
