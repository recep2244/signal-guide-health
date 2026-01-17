/**
 * Authentication Service
 * JWT-based authentication for clinicians and patients
 */

import { ApiClient, apiClient } from "../api/client";

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = "clinician" | "patient" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  patientId?: string; // For patient accounts
  clinicianId?: string; // For clinician accounts
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
  nhsNumber?: string; // For patient registration
  clinicianId?: string; // For clinician registration
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

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------

  /**
   * Login with email and password
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>("/auth/login", request);

    if (!response.data.mfaRequired) {
      this.setSession(response.data.user, response.data.tokens);
    }

    return response.data;
  }

  /**
   * Complete MFA verification
   */
  async verifyMfa(
    email: string,
    mfaCode: string,
    temporaryToken: string
  ): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>("/auth/mfa/verify", {
      email,
      mfaCode,
      temporaryToken,
    });

    this.setSession(response.data.user, response.data.tokens);
    return response.data;
  }

  /**
   * Register new user
   */
  async register(request: RegisterRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>(
      "/auth/register",
      request
    );

    this.setSession(response.data.user, response.data.tokens);
    return response.data;
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await this.client.post("/auth/logout", { refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    this.refreshPromise = this.client
      .post<AuthTokens>("/auth/refresh", { refreshToken })
      .then((response) => {
        const tokens = response.data;
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

  /**
   * Request password reset email
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    await this.client.post("/auth/password/reset", request);
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<void> {
    await this.client.post("/auth/password/confirm", request);
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.client.post("/auth/password/change", {
      currentPassword,
      newPassword,
    });
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);

    if (!token || !expiresAt) return false;

    const now = Date.now();
    const expires = parseInt(expiresAt, 10);

    return now < expires;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: Permission): boolean {
    return this.currentUser?.permissions.includes(permission) ?? false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  /**
   * Get current session info
   */
  async getSessionInfo(): Promise<SessionInfo> {
    const response = await this.client.get<SessionInfo>("/auth/session");
    return response.data;
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
        this.currentUser = JSON.parse(userJson);
        this.client.setAuthToken(token);
      } catch {
        this.clearSession();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AUTO-REFRESH SETUP
  // ---------------------------------------------------------------------------

  /**
   * Setup automatic token refresh
   */
  setupAutoRefresh(): () => void {
    const checkInterval = 60000; // Check every minute

    const intervalId = setInterval(async () => {
      const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      if (!expiresAt) return;

      const expires = parseInt(expiresAt, 10);
      const now = Date.now();
      const timeUntilExpiry = expires - now;

      // Refresh if less than 5 minutes until expiry
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
