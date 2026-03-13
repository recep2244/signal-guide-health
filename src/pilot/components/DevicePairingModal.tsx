/**
 * DevicePairingModal
 * Tabs: QR Code | Manual Code | Deep Link
 * Polls /pairing/status every 3s to detect successful pairing.
 */
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, QrCode, Hash, Link2, Wifi, CheckCircle2, Loader2, Nfc } from 'lucide-react';
import { toast } from 'sonner';

interface PairingSession {
  token: string;
  shortCode: string;
  qrPayload: string;
  expiresAt: string;
}

interface ConnectedDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  connectionStatus: string;
}

interface DevicePairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  apiBaseUrl?: string;
  initialToken?: string;
  initialShortCode?: string;
  initialQrPayload?: string;
}

const PAIRING_TTL_SECONDS = 15 * 60; // 15 minutes

export function DevicePairingModal({ open, onOpenChange, patientId, apiBaseUrl = '', initialToken, initialShortCode, initialQrPayload }: DevicePairingModalProps) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(PAIRING_TTL_SECONDS);
  const [paired, setPaired] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<ConnectedDevice[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate pairing session when modal opens
  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setSession(null);
      setQrDataUrl('');
      setPaired(false);
      setSecondsLeft(PAIRING_TTL_SECONDS);
      return;
    }
    // Use pre-fetched session data if provided (e.g. from handleRequestLiveSync)
    if (initialToken && initialShortCode && initialQrPayload) {
      const preSession: PairingSession = {
        token: initialToken,
        shortCode: initialShortCode,
        qrPayload: initialQrPayload,
        expiresAt: new Date(Date.now() + PAIRING_TTL_SECONDS * 1000).toISOString(),
      };
      setSession(preSession);
      void QRCode.toDataURL(initialQrPayload, { width: 240, margin: 2 }).then(setQrDataUrl);
      return;
    }
    void generateSession();
  }, [open, patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateSession() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/pairing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId }),
      });
      const json = await res.json() as { status: string; data: PairingSession };
      if (!res.ok) throw new Error('Failed to generate pairing session');
      const s = json.data;
      setSession(s);

      // Render QR code to data URL
      const dataUrl = await QRCode.toDataURL(s.qrPayload, { width: 240, margin: 2 });
      setQrDataUrl(dataUrl);

      // Countdown timer
      const expiryMs = new Date(s.expiresAt).getTime();
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining === 0 && countdownRef.current) clearInterval(countdownRef.current);
      }, 1000);

      // Poll for pairing confirmation
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${apiBaseUrl}/api/v1/pairing/status/${patientId}`, {
            credentials: 'include',
          });
          const pollJson = await pollRes.json() as { status: string; data: { devices: ConnectedDevice[] } };
          if (pollJson.data.devices.length > 0) {
            setPairedDevices(pollJson.data.devices);
            setPaired(true);
            if (pollRef.current) clearInterval(pollRef.current);
            toast.success('Device paired successfully!');
          }
        } catch {
          // Swallow poll errors silently
        }
      }, 3000);
    } catch {
      toast.error('Could not start pairing session. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const openDeepLink = () => {
    if (!session) return;
    window.location.href = session.qrPayload;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone size={18} className="text-teal-600" />
            Connect Wearable Device
          </DialogTitle>
        </DialogHeader>

        {paired ? (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-900">Device Paired!</p>
            <p className="text-sm text-slate-500 mt-1">
              {pairedDevices[0]?.deviceName ?? 'Device'} is now connected.
            </p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-teal-600" />
          </div>
        ) : session ? (
          <Tabs defaultValue="qr">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="qr" className="flex items-center gap-1.5">
                <QrCode size={14} />
                QR Code
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-1.5">
                <Hash size={14} />
                Manual Code
              </TabsTrigger>
              <TabsTrigger value="deeplink" className="flex items-center gap-1.5">
                <Link2 size={14} />
                Deep Link
              </TabsTrigger>
            </TabsList>

            {/* QR Tab */}
            <TabsContent value="qr" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                Open the CardioWatch app on the patient's phone and scan this code.
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Pairing QR code" className="mx-auto rounded-xl border-2 border-slate-200" width={240} height={240} />
              ) : (
                <div className="w-60 h-60 mx-auto bg-slate-100 rounded-xl flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">
                Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
              </p>

              {/* NFC indicator — informational */}
              <div className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Nfc size={16} className="text-blue-500" />
                <p className="text-xs text-blue-700">Hold phone to device for NFC pairing (if supported)</p>
              </div>
            </TabsContent>

            {/* Manual Code Tab */}
            <TabsContent value="manual" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                Enter this 6-digit code in the CardioWatch app.
              </p>
              <div className="text-5xl font-mono font-bold tracking-widest text-slate-900 py-4">
                {session.shortCode}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Wifi size={14} className="text-amber-500" />
                <p className="text-xs text-slate-400">
                  Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
                </p>
              </div>
              <Badge variant="outline" className="mt-4 text-xs bg-amber-50 text-amber-700 border-amber-200">
                Waiting for confirmation...
              </Badge>
            </TabsContent>

            {/* Deep Link Tab */}
            <TabsContent value="deeplink" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                On a mobile device? Tap the button below to open the CardioWatch app directly.
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={openDeepLink}
              >
                <Link2 size={16} className="mr-2" />
                Open CardioWatch App
              </Button>
              <p className="text-xs text-slate-400 mt-3 break-all font-mono">{session.qrPayload}</p>
              <p className="text-xs text-slate-400 mt-1">
                Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
              </p>

              {/* NFC indicator */}
              <div className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Nfc size={16} className="text-blue-500" />
                <p className="text-xs text-blue-700">Hold phone to device for NFC pairing (if supported)</p>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
