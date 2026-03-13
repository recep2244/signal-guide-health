/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;

  // Authentication
  readonly VITE_AUTH_DOMAIN: string;
  readonly VITE_AUTH_CLIENT_ID: string;
  readonly VITE_AUTH_AUDIENCE: string;

  // Push Notifications
  readonly VITE_FCM_VAPID_KEY: string;
  readonly VITE_FCM_PROJECT_ID: string;

  // Analytics
  readonly VITE_ANALYTICS_ID: string;
  readonly VITE_SENTRY_DSN: string;

  // Feature Flags
  readonly VITE_ENABLE_MOCK_DATA: string;
  readonly VITE_ENABLE_PILOT_MOCK_DATA: string;
  readonly VITE_ENABLE_REAL_TIME_SYNC: string;
  readonly VITE_ENABLE_PUSH_NOTIFICATIONS: string;
  readonly VITE_ENABLE_ADMIN_UI: string;
  readonly VITE_DEPLOY_TARGET: string;
  readonly VITE_BASE_PATH?: string;

  // Environment
  readonly VITE_APP_ENV: "development" | "staging" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
