import { createContext, useCallback, useContext, useMemo, useState } from "react";

type AlertsContextValue = {
  resolvedAlertIds: Set<string>;
  resolveAlert: (alertId: string) => void;
  isAlertResolved: (alertId: string) => boolean;
};

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Set<string>>(new Set());

  const resolveAlert = useCallback((alertId: string) => {
    setResolvedAlertIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }, []);

  const isAlertResolved = useCallback(
    (alertId: string) => resolvedAlertIds.has(alertId),
    [resolvedAlertIds]
  );

  const value = useMemo(
    () => ({ resolvedAlertIds, resolveAlert, isAlertResolved }),
    [resolvedAlertIds, resolveAlert, isAlertResolved]
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error("useAlerts must be used within AlertsProvider");
  }
  return context;
}
