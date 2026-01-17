/**
 * API Client Infrastructure
 * Base HTTP client with interceptors, retry logic, and error handling
 */

import { API_TIMEOUT_MS, API_RETRY_COUNT } from "@/config/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

// ============================================================================
// API CLIENT CLASS
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeout = config.timeout ?? API_TIMEOUT_MS;
    this.retries = config.retries ?? API_RETRY_COUNT;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  // ---------------------------------------------------------------------------
  // INTERCEPTORS
  // ---------------------------------------------------------------------------

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  // ---------------------------------------------------------------------------
  // AUTH HELPERS
  // ---------------------------------------------------------------------------

  setAuthToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders["Authorization"];
  }

  // ---------------------------------------------------------------------------
  // REQUEST METHODS
  // ---------------------------------------------------------------------------

  async get<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // CORE REQUEST HANDLER
  // ---------------------------------------------------------------------------

  private async request<T>(path: string, options: RequestInit): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    let config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...(options.headers as Record<string, string>),
      },
    };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, config);

        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse);
        }

        if (!processedResponse.ok) {
          const errorBody = await processedResponse.text();
          throw new ApiClientError(
            `HTTP ${processedResponse.status}: ${processedResponse.statusText}`,
            processedResponse.status,
            errorBody
          );
        }

        const data = await processedResponse.json();
        return {
          data: data as T,
          status: processedResponse.status,
          headers: processedResponse.headers,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Exponential backoff
        if (attempt < this.retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class ApiClientError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

// ============================================================================
// DEFAULT CLIENT INSTANCE
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
});

export default apiClient;
