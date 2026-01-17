import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { STORAGE_KEY_RESOLVED_ALERTS } from "@/config/constants";

// ============================================================================
// TYPES
// ============================================================================

type AlertsContextValue = {
  /** Set of resolved alert IDs */
  resolvedAlertIds: Set<string>;
  /** Mark an alert as resolved */
  resolveAlert: (alertId: string) => void;
  /** Check if an alert is resolved */
  isAlertResolved: (alertId: string) => boolean;
  /** Unresolve an alert (undo) */
  unresolveAlert: (alertId: string) => void;
  /** Clear all resolved alerts */
  clearResolvedAlerts: () => void;
  /** Total count of resolved alerts */
  resolvedCount: number;
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function loadResolvedAlerts(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RESOLVED_ALERTS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (error) {
    console.warn("Failed to load resolved alerts from storage:", error);
  }
  return new Set();
}

function saveResolvedAlerts(alertIds: Set<string>): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_RESOLVED_ALERTS,
      JSON.stringify(Array.from(alertIds))
    );
  } catch (error) {
    console.warn("Failed to save resolved alerts to storage:", error);
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Set<string>>(() =>
    loadResolvedAlerts()
  );

  // Persist to localStorage when resolved alerts change
  useEffect(() => {
    saveResolvedAlerts(resolvedAlertIds);
  }, [resolvedAlertIds]);

  const resolveAlert = useCallback((alertId: string) => {
    setResolvedAlertIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }, []);

  const unresolveAlert = useCallback((alertId: string) => {
    setResolvedAlertIds((prev) => {
      if (!prev.has(alertId)) return prev;
      const next = new Set(prev);
      next.delete(alertId);
      return next;
    });
  }, []);

  const clearResolvedAlerts = useCallback(() => {
    setResolvedAlertIds(new Set());
  }, []);

  const isAlertResolved = useCallback(
    (alertId: string) => resolvedAlertIds.has(alertId),
    [resolvedAlertIds]
  );

  const resolvedCount = resolvedAlertIds.size;

  const value = useMemo(
    () => ({
      resolvedAlertIds,
      resolveAlert,
      isAlertResolved,
      unresolveAlert,
      clearResolvedAlerts,
      resolvedCount,
    }),
    [
      resolvedAlertIds,
      resolveAlert,
      isAlertResolved,
      unresolveAlert,
      clearResolvedAlerts,
      // resolvedCount is derived from resolvedAlertIds, no need to include it
    ]
  );

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error("useAlerts must be used within AlertsProvider");
  }
  return context;
}
