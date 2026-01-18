/**
 * Device Pairing Component
 * Allows patients to connect their wearable devices
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Watch, Smartphone, RefreshCw, Unplug, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { WearableProvider } from '@/services/wearables/types';

interface WearableProviderInfo {
  id: WearableProvider;
  name: string;
  icon: 'apple' | 'android' | 'fitbit' | 'garmin' | 'samsung' | 'withings';
  type: 'push' | 'oauth';
  platforms: string[];
  capabilities: string[];
  requiresApp: boolean;
}

interface ConnectedDevice {
  id: string;
  deviceType: WearableProvider;
  deviceName: string;
  deviceModel?: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  connectionStatus: string;
  batteryLevel?: number;
}

const PROVIDER_INFO: WearableProviderInfo[] = [
  {
    id: 'apple_watch',
    name: 'Apple Watch',
    icon: 'apple',
    type: 'push',
    platforms: ['iOS'],
    capabilities: ['Heart Rate', 'HRV', 'ECG', 'Blood Oxygen', 'Sleep', 'Activity'],
    requiresApp: true,
  },
  {
    id: 'wear_os',
    name: 'Wear OS',
    icon: 'android',
    type: 'push',
    platforms: ['Android'],
    capabilities: ['Heart Rate', 'HRV', 'Sleep', 'Activity', 'Blood Oxygen'],
    requiresApp: true,
  },
  {
    id: 'health_connect',
    name: 'Health Connect',
    icon: 'android',
    type: 'push',
    platforms: ['Android'],
    capabilities: ['Heart Rate', 'HRV', 'Sleep', 'Activity', 'Blood Oxygen', 'Blood Pressure'],
    requiresApp: true,
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: 'fitbit',
    type: 'oauth',
    platforms: ['iOS', 'Android', 'Web'],
    capabilities: ['Heart Rate', 'HRV', 'Sleep', 'Activity', 'Blood Oxygen'],
    requiresApp: false,
  },
  {
    id: 'garmin',
    name: 'Garmin',
    icon: 'garmin',
    type: 'oauth',
    platforms: ['iOS', 'Android', 'Web'],
    capabilities: ['Heart Rate', 'HRV', 'Sleep', 'Activity', 'Stress'],
    requiresApp: false,
  },
  {
    id: 'samsung_health',
    name: 'Samsung Health',
    icon: 'samsung',
    type: 'push',
    platforms: ['Android'],
    capabilities: ['Heart Rate', 'HRV', 'ECG', 'Blood Oxygen', 'Blood Pressure', 'Sleep'],
    requiresApp: true,
  },
  {
    id: 'withings',
    name: 'Withings',
    icon: 'withings',
    type: 'oauth',
    platforms: ['iOS', 'Android', 'Web'],
    capabilities: ['Heart Rate', 'Blood Pressure', 'Weight', 'Sleep', 'ECG'],
    requiresApp: false,
  },
];

function ProviderIcon({ icon }: { icon: WearableProviderInfo['icon'] }) {
  switch (icon) {
    case 'apple':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      );
    case 'android':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.6 11.4c-.2-.3-.5-.5-.8-.5-.3 0-.6.2-.8.5l-1.5 2.6c-.2.3-.2.7 0 1l1.5 2.6c.2.3.5.5.8.5.3 0 .6-.2.8-.5l1.5-2.6c.2-.3.2-.7 0-1l-1.5-2.6zM6.4 11.4c-.2-.3-.5-.5-.8-.5-.3 0-.6.2-.8.5l-1.5 2.6c-.2.3-.2.7 0 1l1.5 2.6c.2.3.5.5.8.5.3 0 .6-.2.8-.5l1.5-2.6c.2-.3.2-.7 0-1l-1.5-2.6zM12 2C9.8 2 7.7 2.7 6 4l1.4 1.4C8.6 4.5 10.2 4 12 4s3.4.5 4.6 1.4L18 4c-1.7-1.3-3.8-2-6-2zm0 4c-1.7 0-3.2.6-4.4 1.6l1.4 1.4C10 8.4 11 8 12 8s2 .4 2.9 1l1.4-1.4C15.2 6.6 13.7 6 12 6zm0 4c-.8 0-1.5.3-2.1.8l2.1 2.1 2.1-2.1c-.6-.5-1.3-.8-2.1-.8z"/>
        </svg>
      );
    default:
      return <Watch className="w-8 h-8" />;
  }
}

export function DevicePairing() {
  const [selectedProvider, setSelectedProvider] = useState<WearableProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch connected devices
  const { data: devices, isLoading: devicesLoading } = useQuery<ConnectedDevice[]>({
    queryKey: ['wearable-devices'],
    queryFn: async () => {
      const response = await fetch('/api/wearables/devices');
      const data = await response.json();
      return data.data?.devices || [];
    },
  });

  // Connect device mutation
  const connectMutation = useMutation({
    mutationFn: async (provider: WearableProvider) => {
      const response = await fetch(`/api/wearables/connect/${provider}`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.data?.type === 'oauth' && data.data?.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.data.authUrl;
      }
      // For push-based providers, show instructions
      setIsConnecting(false);
    },
  });

  // Disconnect device mutation
  const disconnectMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await fetch(`/api/wearables/disconnect/${deviceId}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wearable-devices'] });
    },
  });

  // Sync device mutation
  const syncMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await fetch(`/api/wearables/sync/${deviceId}`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wearable-devices'] });
    },
  });

  const handleConnect = (provider: WearableProvider) => {
    setSelectedProvider(provider);
    setIsConnecting(true);
    connectMutation.mutate(provider);
  };

  const connectedProviders = new Set(devices?.map((d) => d.deviceType) || []);

  return (
    <div className="space-y-6">
      {/* Connected Devices */}
      {devices && devices.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Connected Devices</h3>
          <div className="space-y-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{device.deviceName}</p>
                    <p className="text-sm text-gray-500">
                      {device.deviceModel && `${device.deviceModel} • `}
                      Last synced:{' '}
                      {device.lastSyncAt
                        ? new Date(device.lastSyncAt).toLocaleString()
                        : 'Never'}
                    </p>
                    {device.batteryLevel !== undefined && (
                      <p className="text-sm text-gray-500">
                        Battery: {device.batteryLevel}%
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => syncMutation.mutate(device.id)}
                    disabled={syncMutation.isPending}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                    title="Sync now"
                  >
                    <RefreshCw
                      className={`w-5 h-5 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => disconnectMutation.mutate(device.id)}
                    disabled={disconnectMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                    title="Disconnect"
                  >
                    <Unplug className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Providers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Connect a Device</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDER_INFO.map((provider) => {
            const isConnected = connectedProviders.has(provider.id);
            const isLoading = isConnecting && selectedProvider === provider.id;

            return (
              <button
                key={provider.id}
                onClick={() => !isConnected && handleConnect(provider.id)}
                disabled={isConnected || isLoading}
                className={`p-4 border rounded-lg text-left transition-all ${
                  isConnected
                    ? 'bg-green-50 border-green-200 cursor-default'
                    : 'hover:border-blue-500 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-gray-700">
                    <ProviderIcon icon={provider.icon} />
                  </div>
                  {isConnected && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                  {isLoading && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                </div>
                <h4 className="font-medium mt-3">{provider.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {provider.platforms.join(', ')}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {provider.capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-1 bg-gray-100 rounded-full"
                    >
                      {cap}
                    </span>
                  ))}
                  {provider.capabilities.length > 3 && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                      +{provider.capabilities.length - 3} more
                    </span>
                  )}
                </div>
                {provider.requiresApp && (
                  <div className="flex items-center mt-3 text-xs text-amber-600">
                    <Smartphone className="w-3 h-3 mr-1" />
                    Requires mobile app
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instructions Modal for Push-based Providers */}
      {connectMutation.isSuccess && connectMutation.data?.data?.type === 'device_push' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Connect Your Device</h3>
            <div className="prose prose-sm">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                {connectMutation.data.data.instructions}
              </pre>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  connectMutation.reset();
                  setSelectedProvider(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <a
                href={
                  selectedProvider === 'apple_watch'
                    ? 'https://apps.apple.com/search?term=cardiowatch'
                    : 'https://play.google.com/store/search?q=cardiowatch'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {(connectMutation.isError || disconnectMutation.isError) && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">
            {connectMutation.error?.message ||
              disconnectMutation.error?.message ||
              'An error occurred'}
          </p>
        </div>
      )}
    </div>
  );
}

export default DevicePairing;
