import { useState, useEffect } from "react";
import { Save, Download, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DeviceSelector from "./DeviceSelector";

interface HeaderProps {
  projectName?: string;
  onExport?: () => void;
  onSettings?: () => void;
}

export default function Header({ projectName = "Untitled Project", onExport, onSettings }: HeaderProps) {
  const [autoSaved, setAutoSaved] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-card-border bg-card/30 backdrop-blur-xl px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-foreground" data-testid="text-project-name">
          {projectName}
        </h1>
        <div className="flex items-center gap-2">
          <Save className={`w-4 h-4 ${autoSaved ? "text-green-500" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">
            {autoSaved ? "Saved" : "Auto-save enabled"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DeviceSelector />
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log("Settings clicked");
              onSettings?.();
            }}
            data-testid="button-settings"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-gradient-purple-blue"
            onClick={() => {
              console.log("Export clicked");
              onExport?.();
            }}
            data-testid="button-export"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}
