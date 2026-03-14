/**
 * DevicePairingModal
 * Tabs: QR Code | Manual Code (TOTP) | Deep Link | NFC Tag | Nearby (BLE)
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

// Web NFC API — available in Chrome on Android; not in lib.dom.d.ts yet
declare class NDEFWriter {
  write(message: { records: Array<{ recordType: string; data: string }> }): Promise<void>;
}

interface PairingSession {
  token: string;
  shortCode: string;
  qrPayload: string;
  expiresAt: string;
  totpSecret?: string; // returned by updated /pairing/generate
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

/** Computes a 6-digit TOTP from a base32 secret using WebCrypto HMAC-SHA1. */
function useTOTP(secret: string | undefined): { code: string; secondsLeft: number } {
  const [code, setCode] = useState('------');
  const [secondsLeft, setSecLeft] = useState(30);

  useEffect(() => {
    if (!secret) return;

    async function computeTOTP(sec: string): Promise<string> {
      // Decode base32 secret to bytes
      const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = '';
      for (const ch of sec.toUpperCase().replace(/=+$/, '')) {
        const idx = base32chars.indexOf(ch);
        if (idx === -1) continue;
        bits += idx.toString(2).padStart(5, '0');
      }
      const keyBytes = new Uint8Array(Math.floor(bits.length / 8));
      for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
      }

      // HOTP counter = floor(epoch / 30)
      const counter = Math.floor(Date.now() / 1000 / 30);
      const counterBuf = new DataView(new ArrayBuffer(8));
      counterBuf.setUint32(4, counter, false);
      const counterBytes = new Uint8Array(counterBuf.buffer);

      const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
      const hash = new Uint8Array(sig);
      const offset = hash[19]! & 0x0f;
      const otp = ((hash[offset]! & 0x7f) << 24 | hash[offset + 1]! << 16 | hash[offset + 2]! << 8 | hash[offset + 3]!) % 1000000;
      return String(otp).padStart(6, '0');
    }

    let cancelled = false;
    const tick = () => {
      const secsInStep = Math.floor(Date.now() / 1000) % 30;
      setSecLeft(30 - secsInStep);
      void computeTOTP(sec).then(c => { if (!cancelled) setCode(c); });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [secret]);

  return { code, secondsLeft };
}

export function DevicePairingModal({ open, onOpenChange, patientId, apiBaseUrl = '', initialToken, initialShortCode, initialQrPayload }: DevicePairingModalProps) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(PAIRING_TTL_SECONDS);
  const [paired, setPaired] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<ConnectedDevice[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'written' | 'error'>('idle');
  const [nfcError, setNfcError] = useState('');
  const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'connecting' | 'written' | 'error'>('idle');
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [bleError, setBleError] = useState('');

  const { code: totpCode, secondsLeft: totpSecondsLeft } = useTOTP(session?.totpSecret);

  // Generate pairing session when modal opens
  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setSession(null);
      setQrDataUrl('');
      setPaired(false);
      setSecondsLeft(PAIRING_TTL_SECONDS);
      setNfcStatus('idle');
      setBleStatus('idle');
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

  async function handleNfcWrite() {
    if (!session) return;
    setNfcStatus('writing');
    setNfcError('');
    try {
      const writer = new NDEFWriter();
      await writer.write({ records: [{ recordType: 'url', data: session.qrPayload }] });
      setNfcStatus('written');
    } catch (err) {
      setNfcStatus('error');
      setNfcError(err instanceof Error ? err.message : 'NFC write failed');
    }
  }

  async function handleBlePair() {
    if (!session) return;
    setBleStatus('scanning');
    setBleError('');
    setBleDeviceName('');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'CardioWatch' }],
        optionalServices: ['0000fe00-0000-1000-8000-00805f9b34fb'],
      });
      setBleDeviceName(device.name ?? 'CardioWatch Device');
      setBleStatus('connecting');
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService('0000fe00-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('0000fe01-0000-1000-8000-00805f9b34fb');
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(session.token));
      setBleStatus('written');
    } catch (err) {
      setBleStatus('error');
      setBleError(err instanceof Error ? err.message : 'BLE pairing failed');
    }
  }

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
            <TabsList className="w-full grid grid-cols-5 mb-4">
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
              <TabsTrigger value="nfc" className="flex items-center gap-1.5">
                <Nfc size={14} />
                NFC Tag
              </TabsTrigger>
              <TabsTrigger value="ble" className="flex items-center gap-1.5">
                <Wifi size={14} />
                Nearby
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
            </TabsContent>

            {/* Manual Code Tab — shows rotating TOTP when available, falls back to shortCode */}
            <TabsContent value="manual" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                Enter this rotating 6-digit code in the CardioWatch app. It refreshes every 30 seconds.
              </p>
              <div className="text-5xl font-mono font-bold tracking-widest text-slate-900 py-4">
                {session.totpSecret ? totpCode : session.shortCode}
              </div>
              {session.totpSecret && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-teal-500"
                    style={{
                      background: `conic-gradient(#14b8a6 ${(totpSecondsLeft / 30) * 360}deg, #e2e8f0 0deg)`,
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    Refreshes in <span className="font-mono font-semibold text-slate-700">{totpSecondsLeft}s</span>
                  </p>
                </div>
              )}
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
            </TabsContent>

            {/* NFC Tag Tab */}
            <TabsContent value="nfc" className="text-center">
              {('NDEFWriter' in (window as Record<string, unknown>)) ? (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Write pairing data to an NFC tag. Hold an NFC tag near your device.
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => void handleNfcWrite()}
                    disabled={nfcStatus === 'writing' || nfcStatus === 'written'}
                  >
                    <Nfc size={16} className="mr-2" />
                    {nfcStatus === 'idle' && 'Write NFC Tag'}
                    {nfcStatus === 'writing' && 'Writing...'}
                    {nfcStatus === 'written' && 'Tag Written!'}
                    {nfcStatus === 'error' && 'Retry'}
                  </Button>
                  {nfcStatus === 'written' && (
                    <p className="text-sm text-green-600 mt-3">NFC tag written. Tap the tag to the device to pair.</p>
                  )}
                  {nfcStatus === 'error' && (
                    <p className="text-sm text-red-500 mt-3">{nfcError}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 py-6">
                  NFC not supported on this browser. Use Chrome on Android.
                </p>
              )}
            </TabsContent>

            {/* BLE (Nearby) Tab */}
            <TabsContent value="ble" className="text-center">
              {'bluetooth' in navigator ? (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Scan for nearby CardioWatch devices via Bluetooth.
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => void handleBlePair()}
                    disabled={bleStatus === 'scanning' || bleStatus === 'connecting' || bleStatus === 'written'}
                  >
                    <Wifi size={16} className="mr-2" />
                    {bleStatus === 'idle' && 'Scan for Device'}
                    {bleStatus === 'scanning' && 'Scanning...'}
                    {bleStatus === 'connecting' && `Connecting to ${bleDeviceName}...`}
                    {bleStatus === 'written' && `Paired with ${bleDeviceName}`}
                    {bleStatus === 'error' && 'Retry Scan'}
                  </Button>
                  {bleStatus === 'written' && (
                    <p className="text-sm text-green-600 mt-3">Token sent. Awaiting device confirmation.</p>
                  )}
                  {bleStatus === 'error' && (
                    <p className="text-sm text-red-500 mt-3">{bleError}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 py-6">
                  BLE not available. Use Chrome on desktop or Android.
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
