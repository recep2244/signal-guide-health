/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;

  // WhatsApp Business API
  readonly VITE_WHATSAPP_PHONE_NUMBER_ID: string;
  readonly VITE_WHATSAPP_ACCESS_TOKEN: string;
  readonly VITE_WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  readonly VITE_WHATSAPP_API_VERSION: string;

  // Wearable OAuth
  readonly VITE_HEALTHKIT_CLIENT_ID: string;
  readonly VITE_GOOGLE_FIT_CLIENT_ID: string;
  readonly VITE_FITBIT_CLIENT_ID: string;

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
  readonly VITE_ENABLE_REAL_TIME_SYNC: string;
  readonly VITE_ENABLE_PUSH_NOTIFICATIONS: string;

  // Environment
  readonly VITE_APP_ENV: "development" | "staging" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
