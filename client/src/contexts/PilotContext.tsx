import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PilotInfo {
  name: string;
  email: string;
}

interface PilotContextType {
  pilotInfo: PilotInfo;
  setPilotInfo: (info: PilotInfo) => void;
  clearPilotInfo: () => void;
}

const PilotContext = createContext<PilotContextType | undefined>(undefined);

const STORAGE_KEY = "flight_pilot_info";

export function PilotProvider({ children }: { children: ReactNode }) {
  const [pilotInfo, setPilotInfoState] = useState<PilotInfo>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { name: "", email: "" };
      }
    }
    return { name: "", email: "" };
  });

  useEffect(() => {
    if (pilotInfo.name || pilotInfo.email) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pilotInfo));
    }
  }, [pilotInfo]);

  const setPilotInfo = (info: PilotInfo) => {
    setPilotInfoState(info);
  };

  const clearPilotInfo = () => {
    setPilotInfoState({ name: "", email: "" });
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <PilotContext.Provider value={{ pilotInfo, setPilotInfo, clearPilotInfo }}>
      {children}
    </PilotContext.Provider>
  );
}

export function usePilot() {
  const context = useContext(PilotContext);
  if (context === undefined) {
    throw new Error("usePilot must be used within a PilotProvider");
  }
  return context;
}
