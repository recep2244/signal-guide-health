/**
 * Authentication Service
 * JWT-based authentication for clinicians and patients
 */

import { ApiClient, apiClient } from "../api/client";

// ============================================================================
// TYPES
// ============================================================================

export type UserRole =
  | "clinician"
  | "doctor"
  | "nurse"
  | "patient"
  | "admin"
  | "super_admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  patientId?: string;
  clinicianId?: string;
  permissions: Permission[];
  lastLoginAt?: string;
  createdAt: string;
}

export type Permission =
  | "patients:read"
  | "patients:write"
  | "patients:delete"
  | "alerts:read"
  | "alerts:resolve"
  | "wearables:read"
  | "wearables:manage"
  | "messages:read"
  | "messages:send"
  | "reports:view"
  | "settings:manage"
  | "users:manage";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  mfaRequired?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  nhsNumber?: string;
  clinicianId?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface SessionInfo {
  user: User;
  expiresAt: string;
  isValid: boolean;
}

interface BackendUserShape {
  id: string;
  email: string;
  role: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  createdAt?: string;
}

interface BackendAuthDataShape {
  user?: BackendUserShape;
  accessToken?: string;
  expiresIn?: number;
  refreshToken?: string;
  mfaRequired?: boolean;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
  };
}

interface BackendAuthEnvelope {
  status: string;
  data: BackendAuthDataShape;
}

interface BackendRefreshEnvelope {
  status: string;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

interface BackendSessionEnvelope {
  status: string;
  data: {
    user: BackendUserShape;
    expiresAt: string;
    isValid: boolean;
  };
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: "cardiowatch_access_token",
  REFRESH_TOKEN: "cardiowatch_refresh_token",
  USER: "cardiowatch_user",
  EXPIRES_AT: "cardiowatch_token_expires",
};

// ============================================================================
// AUTH SERVICE CLASS
// ============================================================================

export class AuthService {
  private client: ApiClient;
  private currentUser: User | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(client: ApiClient) {
    this.client = client;
    this.loadStoredSession();
  }

  private toRole(value: string | undefined): UserRole {
    if (
      value === "doctor" ||
      value === "nurse" ||
      value === "patient" ||
      value === "admin" ||
      value === "super_admin"
    ) {
      return value;
    }
    if (value === "clinician") {
      return "clinician";
    }
    return "clinician";
  }

  private toUser(value: BackendUserShape | undefined): User {
    const firstName = value?.firstName?.trim() || "";
    const lastName = value?.lastName?.trim() || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    return {
      id: value?.id || "unknown",
      email: value?.email || "",
      name: value?.name || fullName || value?.email || "Unknown User",
      role: this.toRole(value?.role),
      permissions: (value?.permissions || []).filter(
        (item): item is Permission => typeof item === "string"
      ),
      createdAt: value?.createdAt || new Date().toISOString(),
    };
  }

  private normalizeAuthResponse(payload: BackendAuthDataShape): LoginResponse {
    const tokens = payload.tokens || {};
    const accessToken = tokens.accessToken || payload.accessToken || "";
    const refreshToken = tokens.refreshToken || payload.refreshToken || "";
    const expiresIn = tokens.expiresIn || payload.expiresIn || 900;

    if (!payload.mfaRequired && (!accessToken || !refreshToken)) {
      throw new Error("Authentication response missing required tokens");
    }

    return {
      user: this.toUser(payload.user),
      mfaRequired: Boolean(payload.mfaRequired),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: "Bearer",
      },
    };
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------

  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<BackendAuthEnvelope>("/auth/login", request);
    const normalized = this.normalizeAuthResponse(response.data.data);

    if (!normalized.mfaRequired) {
      this.setSession(normalized.user, normalized.tokens);
    }

    return normalized;
  }

  async verifyMfa(
    email: string,
    mfaCode: string,
    temporaryToken: string
  ): Promise<LoginResponse> {
    const response = await this.client.post<BackendAuthEnvelope>("/auth/mfa/verify", {
      email,
      mfaCode,
      temporaryToken,
    });

    const normalized = this.normalizeAuthResponse(response.data.data);
    this.setSession(normalized.user, normalized.tokens);
    return normalized;
  }

  async register(request: RegisterRequest): Promise<LoginResponse> {
    const [firstName, ...rest] = request.name.trim().split(/\s+/);
    const response = await this.client.post<BackendAuthEnvelope>("/auth/register", {
      email: request.email,
      password: request.password,
      firstName: firstName || request.name,
      lastName: rest.join(" ") || "User",
      role: request.role === "clinician" ? "doctor" : request.role,
    });

    const normalized = this.normalizeAuthResponse(response.data.data);
    this.setSession(normalized.user, normalized.tokens);
    return normalized;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post("/auth/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearSession();
    }
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    this.refreshPromise = this.client
      .post<BackendRefreshEnvelope>("/auth/refresh", { refreshToken })
      .then((response) => {
        const tokens: AuthTokens = {
          accessToken: response.data.data.accessToken,
          refreshToken,
          expiresIn: response.data.data.expiresIn,
          tokenType: "Bearer",
        };
        this.storeTokens(tokens);
        this.client.setAuthToken(tokens.accessToken);
        return tokens;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // ---------------------------------------------------------------------------
  // PASSWORD MANAGEMENT
  // ---------------------------------------------------------------------------

  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    await this.client.post("/auth/password/reset", request);
  }

  async confirmPasswordReset(request: PasswordResetConfirm): Promise<void> {
    await this.client.post("/auth/password/confirm", request);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.post("/auth/password/change", {
      currentPassword,
      newPassword,
    });
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);

    if (!token || !expiresAt) return false;

    const now = Date.now();
    const expires = parseInt(expiresAt, 10);

    return now < expires;
  }

  hasPermission(permission: Permission): boolean {
    return this.currentUser?.permissions.includes(permission) ?? false;
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  async getSessionInfo(): Promise<SessionInfo> {
    const response = await this.client.get<BackendSessionEnvelope>("/auth/session");
    return {
      user: this.toUser(response.data.data.user),
      expiresAt: response.data.data.expiresAt,
      isValid: response.data.data.isValid,
    };
  }

  // ---------------------------------------------------------------------------
  // TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  private setSession(user: User, tokens: AuthTokens): void {
    this.currentUser = user;
    this.storeTokens(tokens);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    this.client.setAuthToken(tokens.accessToken);
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);

    const expiresAt = Date.now() + tokens.expiresIn * 1000;
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
  }

  private clearSession(): void {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    this.client.clearAuthToken();
  }

  private loadStoredSession(): void {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    const token = this.getAccessToken();

    if (userJson && token && this.isAuthenticated()) {
      try {
        this.currentUser = JSON.parse(userJson) as User;
        this.client.setAuthToken(token);
      } catch {
        this.clearSession();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AUTO-REFRESH SETUP
  // ---------------------------------------------------------------------------

  setupAutoRefresh(): () => void {
    const checkInterval = 60000;

    const intervalId = setInterval(async () => {
      const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      if (!expiresAt) return;

      const expires = parseInt(expiresAt, 10);
      const now = Date.now();
      const timeUntilExpiry = expires - now;

      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error("Auto-refresh failed:", error);
          this.clearSession();
        }
      }
    }, checkInterval);

    return () => clearInterval(intervalId);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let authServiceInstance: AuthService | null = null;

export function initAuthService(client: ApiClient = apiClient): AuthService {
  authServiceInstance = new AuthService(client);
  return authServiceInstance;
}

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(apiClient);
  }
  return authServiceInstance;
}

export default AuthService;
