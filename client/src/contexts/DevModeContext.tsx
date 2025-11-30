import { createContext, useContext, useState, ReactNode } from "react";

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(() => {
    return sessionStorage.getItem("magnum_dev_mode") === "true";
  });

  const toggleDevMode = () => {
    setIsDevMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        sessionStorage.setItem("magnum_dev_mode", "true");
      } else {
        sessionStorage.removeItem("magnum_dev_mode");
      }
      return newValue;
    });
  };

  return (
    <DevModeContext.Provider value={{ isDevMode, toggleDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error("useDevMode must be used within a DevModeProvider");
  }
  return context;
}
