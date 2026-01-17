/**
 * Authentication Context
 * Provides auth state and methods throughout the application
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAuthService,
  User,
  LoginRequest,
  LoginResponse,
  Permission,
} from "@/services/auth/authService";

// ============================================================================
// TYPES
// ============================================================================

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (request: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  clearError: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const authService = getAuthService();
    const currentUser = authService.getCurrentUser();

    if (currentUser && authService.isAuthenticated()) {
      setUser(currentUser);
      // Set up auto-refresh
      const cleanup = authService.setupAutoRefresh();
      setIsLoading(false);
      return cleanup;
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (request: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const authService = getAuthService();
      const response = await authService.login(request);

      if (!response.mfaRequired) {
        setUser(response.user);
        authService.setupAutoRefresh();
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const authService = getAuthService();
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      return user?.permissions.includes(permission) ?? false;
    },
    [user]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      hasPermission,
      clearError,
    }),
    [user, isLoading, error, login, logout, hasPermission, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// ============================================================================
// DEMO/MOCK AUTH HOOK (For development without backend)
// ============================================================================

export function useDemoAuth() {
  const [user, setUser] = useState<User | null>(() => {
    // Check if demo user exists in localStorage
    const stored = localStorage.getItem("demo_user");
    return stored ? JSON.parse(stored) : null;
  });

  const demoLogin = useCallback((role: "clinician" | "patient" = "clinician") => {
    const demoUser: User = {
      id: `demo-${role}-001`,
      email: `demo.${role}@cardiowatch.com`,
      name: role === "clinician" ? "Dr. Demo Clinician" : "Demo Patient",
      role,
      permissions: role === "clinician"
        ? [
            "patients:read",
            "patients:write",
            "alerts:read",
            "alerts:resolve",
            "wearables:read",
            "messages:read",
            "messages:send",
          ]
        : ["patients:read", "wearables:read", "messages:read"],
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("demo_user", JSON.stringify(demoUser));
    setUser(demoUser);
    return demoUser;
  }, []);

  const demoLogout = useCallback(() => {
    localStorage.removeItem("demo_user");
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    demoLogin,
    demoLogout,
  };
}
