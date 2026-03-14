---
phase: quick-12
plan: 12
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/pairing.ts
  - src/pilot/components/DevicePairingModal.tsx
autonomous: true
requirements: [PAIR-TOTP, PAIR-NFC, PAIR-BLE, PAIR-SEC]

must_haves:
  truths:
    - "POST /pairing/confirm is rate-limited to 10 attempts per 5 min per IP"
    - "GET /pairing/status/:patientId accepts optional createdAfter ISO param and filters results"
    - "DELETE /pairing/cleanup removes expired unused tokens (admin only)"
    - "POST /pairing/generate returns totpSecret; confirm accepts totpCode and validates via otplib"
    - "Manual Code tab shows a rotating TOTP code with 30s countdown, not the static shortCode"
    - "NFC Tag tab writes qrPayload to an NFC tag via NDEFWriter with graceful fallback message"
    - "Nearby (BLE) tab scans for CardioWatch devices, connects GATT, writes token as UTF-8"
    - "tsc --noEmit exits 0 on both frontend and backend"
  artifacts:
    - path: "backend/src/routes/pairing.ts"
      provides: "Rate-limited confirm, createdAfter filter, cleanup endpoint, TOTP support"
    - path: "src/pilot/components/DevicePairingModal.tsx"
      provides: "TOTP tab, NFC tab, BLE tab with fallbacks"
  key_links:
    - from: "POST /pairing/generate"
      to: "DevicePairingModal generateSession()"
      via: "totpSecret field in response JSON used by useTOTP hook"
    - from: "useTOTP hook (WebCrypto HMAC-SHA1)"
      to: "POST /pairing/confirm"
      via: "totpCode body param validated by otplib.authenticator.check"
    - from: "NDEFWriter.write()"
      to: "session.qrPayload"
      via: "NFC tab activate handler"
    - from: "navigator.bluetooth.requestDevice()"
      to: "GATT characteristic 0000fe01-..."
      via: "BLE tab scan -> connect -> write token bytes"
---

<objective>
Upgrade device pairing with four focused changes: backend security hardening + TOTP validation,
frontend TOTP rotating code display, NFC tag writing tab, and BLE proximity pairing tab.

Purpose: Replace static short code with time-based rotating code (more secure), add hardware
pairing channels (NFC + BLE) for clinic workflow, and prevent brute-force on confirm endpoint.

Output: Updated pairing.ts (4 route changes) + updated DevicePairingModal.tsx (3 new tabs/upgrades).
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@backend/src/routes/pairing.ts
@src/pilot/components/DevicePairingModal.tsx

<interfaces>
<!-- Existing pairing.ts exports Router as default. Uses: prisma, authenticate, requireRole, WearableType, z, crypto -->
<!-- otplib already in backend/package.json ^12.0.1 — import { authenticator } from 'otplib' -->
<!-- express-rate-limit already in backend/package.json ^7.1.5 — import rateLimit from 'express-rate-limit' -->

<!-- DevicePairingModal current state (src/pilot/components/DevicePairingModal.tsx): -->
<!-- PairingSession interface: { token, shortCode, qrPayload, expiresAt } -->
<!-- 3 tabs: qr | manual | deeplink -->
<!-- generateSession() POSTs to /api/v1/pairing/generate, sets session state -->
<!-- Polling: GET /api/v1/pairing/status/:patientId every 3s, checks devices.length > 0 -->
<!-- Icons already imported: Smartphone, QrCode, Hash, Link2, Wifi, CheckCircle2, Loader2, Nfc -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend security + TOTP endpoints</name>
  <files>backend/src/routes/pairing.ts</files>
  <action>
Make four targeted edits to backend/src/routes/pairing.ts:

1. ADD IMPORTS at top (after existing imports):
   ```typescript
   import rateLimit from 'express-rate-limit';
   import { authenticator } from 'otplib';
   ```

2. ADD rate limiter constant after the router declaration:
   ```typescript
   const confirmRateLimit = rateLimit({
     windowMs: 5 * 60 * 1000, // 5 minutes
     max: 10,
     standardHeaders: true,
     legacyHeaders: false,
     message: { status: 'error', message: 'Too many confirm attempts. Try again in 5 minutes.' },
   });
   ```

3. MODIFY POST /pairing/generate:
   - After creating the token/shortCode/expiresAt, derive TOTP secret:
     ```typescript
     const totpSecret = Buffer.from(token.substring(0, 20)).toString('base64').replace(/[^A-Z2-7]/gi, 'A').toUpperCase().substring(0, 32);
     ```
     Note: otplib requires a valid base32 string. Use the simpler approach: derive via Buffer base64 then replace non-base32 chars. Actually use this reliable approach:
     ```typescript
     // Derive a stable base32 TOTP secret from the token's first 20 bytes
     const tokenBytes = Buffer.from(token.substring(0, 40), 'hex'); // 20 bytes
     const totpSecret = tokenBytes.toString('base64url').toUpperCase().replace(/-/g, 'A').replace(/_/g, 'B').substring(0, 32);
     ```
   - Change the generate response to include totpSecret:
     ```typescript
     res.status(201).json({
       status: 'success',
       data: { token, shortCode, qrPayload, expiresAt, totpSecret },
     });
     ```

4. MODIFY POST /pairing/confirm:
   - Add confirmRateLimit middleware to the route:
     Change `router.post('/confirm', requireRole(...)` to
     `router.post('/confirm', confirmRateLimit, requireRole(...)`
   - Update confirmSchema to accept optional totpCode:
     ```typescript
     const confirmSchema = z.object({
       token: z.string().optional(),
       shortCode: z.string().regex(/^\d{6}$/).optional(),
       totpCode: z.string().regex(/^\d{6}$/).optional(),
       deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
       deviceName: z.string().optional(),
     }).refine(d => d.token || d.shortCode || d.totpCode, { message: 'token, shortCode, or totpCode required' });
     ```
   - Inside the confirm handler, after finding pairingToken, add TOTP validation branch:
     ```typescript
     // If totpCode provided, verify it against the TOTP secret derived from the token
     if (body.totpCode && pairingToken) {
       const tokenBytes = Buffer.from(pairingToken.token.substring(0, 40), 'hex');
       const derivedSecret = tokenBytes.toString('base64url').toUpperCase().replace(/-/g, 'A').replace(/_/g, 'B').substring(0, 32);
       if (!authenticator.check(body.totpCode, derivedSecret)) {
         res.status(400).json({ status: 'error', message: 'Invalid or expired TOTP code' });
         return;
       }
     }
     ```

5. MODIFY GET /pairing/status/:patientId:
   - Add createdAfter filter. Inside the handler, before the findMany call:
     ```typescript
     const createdAfter = req.query['createdAfter'];
     const createdAfterDate = createdAfter ? new Date(createdAfter as string) : undefined;
     ```
   - Update the where clause:
     ```typescript
     where: {
       patientId,
       isConnected: true,
       ...(createdAfterDate ? { createdAt: { gt: createdAfterDate } } : {}),
     },
     ```

6. ADD DELETE /pairing/cleanup endpoint (before `export default router`):
   ```typescript
   /**
    * DELETE /pairing/cleanup
    * Admin-only: removes all expired unused PairingTokens.
    */
   router.delete('/cleanup', requireRole('admin'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
     try {
       const result = await prisma.pairingToken.deleteMany({
         where: { expiresAt: { lt: new Date() }, usedAt: null },
       });
       res.json({ status: 'success', data: { deleted: result.count } });
     } catch (err) {
       next(err);
     }
   });
   ```

After all edits: run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit` — must exit 0.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | tail -5; echo "Exit: $?"</automated>
  </verify>
  <done>
    tsc --noEmit exits 0 on backend. pairing.ts has: rateLimit on /confirm, totpSecret in /generate response, totpCode validation in /confirm, createdAfter filter in /status/:patientId, DELETE /pairing/cleanup endpoint.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend TOTP rotating code + NFC tab + BLE tab</name>
  <files>src/pilot/components/DevicePairingModal.tsx</files>
  <action>
Rewrite DevicePairingModal.tsx with these targeted additions. Keep all existing code intact; add the following:

**A. Extend PairingSession interface** — add totpSecret field:
```typescript
interface PairingSession {
  token: string;
  shortCode: string;
  qrPayload: string;
  expiresAt: string;
  totpSecret?: string; // returned by updated /pairing/generate
}
```

**B. Add inline NDEFWriter type declaration** (just after imports, before PairingSession interface):
```typescript
// Web NFC API — available in Chrome on Android; not in lib.dom.d.ts yet
declare class NDEFWriter {
  write(message: { records: Array<{ recordType: string; data: string }> }): Promise<void>;
}
```

**C. Add useTOTP hook** (inside the file, before the DevicePairingModal component function):
```typescript
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
```

**D. Inside DevicePairingModal component** — add state for NFC and BLE:
```typescript
const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'written' | 'error'>('idle');
const [nfcError, setNfcError] = useState('');
const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'connecting' | 'written' | 'error'>('idle');
const [bleDeviceName, setBleDeviceName] = useState('');
const [bleError, setBleError] = useState('');
```

**E. Add useTOTP invocation** at the top of the component body (after state declarations):
```typescript
const { code: totpCode, secondsLeft: totpSecondsLeft } = useTOTP(session?.totpSecret);
```

**F. Add NFC write handler**:
```typescript
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
```

**G. Add BLE pairing handler**:
```typescript
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
```

**H. Update Tabs grid and triggers** — change `grid-cols-3` to `grid-cols-5` and add two new triggers:
```tsx
<TabsList className="w-full grid grid-cols-5 mb-4">
  {/* existing 3 triggers unchanged */}
  <TabsTrigger value="nfc" className="flex items-center gap-1.5">
    <Nfc size={14} />
    NFC Tag
  </TabsTrigger>
  <TabsTrigger value="ble" className="flex items-center gap-1.5">
    <Wifi size={14} />
    Nearby
  </TabsTrigger>
</TabsList>
```

**I. Replace Manual Code tab content** to show TOTP instead of static shortCode:
Replace the existing `<TabsContent value="manual">` block with:
```tsx
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
```

**J. Add NFC tab content** (after deeplink TabsContent):
```tsx
<TabsContent value="nfc" className="text-center">
  {'NDEFWriter' in window ? (
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
```

**K. Add BLE tab content** (after NFC TabsContent):
```tsx
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
```

After all edits, also reset nfcStatus and bleStatus to 'idle' in the cleanup useEffect (the one that runs when `!open`):
Add `setNfcStatus('idle'); setBleStatus('idle');` alongside the existing resets.

Run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit` — must exit 0.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | tail -10; echo "Exit: $?"</automated>
  </verify>
  <done>
    Frontend tsc --noEmit exits 0. DevicePairingModal has 5 tabs (QR, Manual/TOTP, Deep Link, NFC Tag, Nearby/BLE). Manual tab shows rotating TOTP code with countdown ring when totpSecret present. NFC tab writes via NDEFWriter with fallback message. BLE tab scans, connects GATT, writes token bytes, shows inline status. Both non-supported-browser cases show descriptive fallback text.
  </done>
</task>

<task type="auto">
  <name>Task 3: Final TypeScript clean pass (both frontend + backend)</name>
  <files>backend/src/routes/pairing.ts, src/pilot/components/DevicePairingModal.tsx</files>
  <action>
Run tsc --noEmit on both projects and fix any remaining type errors.

```bash
# Backend
cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend
npx tsc --noEmit 2>&1

# Frontend
cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health
npx tsc --noEmit 2>&1
```

Common issues to fix if they appear:

1. **Backend — `rateLimit` import**: If TS complains about default import, use:
   `import rateLimit from 'express-rate-limit';` (already in express-rate-limit v7 types)

2. **Backend — `totpSecret` in generate response**: If Prisma complains that PairingToken model
   does not have `totpSecret` column — it does NOT need to be stored. It is derived on-the-fly
   from the token value. The generate route computes it and returns it in the response JSON only.
   The confirm route re-derives it from pairingToken.token. No schema change needed.

3. **Frontend — `NDEFWriter` not in window check**: TypeScript may flag `'NDEFWriter' in window`.
   If so, cast: `('NDEFWriter' in (window as Record<string, unknown>))`.

4. **Frontend — `navigator.bluetooth`**: Web Bluetooth types are in lib.dom.d.ts (TypeScript 4.9+).
   If compiler complains, check tsconfig.json has `"lib": ["ES2020", "DOM", "DOM.Iterable"]`.
   Do NOT install @types/web-bluetooth — the built-in types cover it.

5. **Frontend — `hash[offset]` possibly undefined**: Use non-null assertion
   `hash[offset]! & 0x7f` etc. (bounded by offset = hash[19] & 0x0f which is always 0-15,
   and hash.length = 20, so indices offset through offset+3 are always valid).

6. **Frontend — `device.gatt`**: navigator.bluetooth.requestDevice returns BluetoothDevice
   which has `gatt?: BluetoothRemoteGATTServer`. The `!` assertion is safe because
   requestDevice only returns devices that support GATT when optionalServices is specified.

After all fixes, both tsc commands must exit 0 with no errors.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -E "error TS|Exit" ; cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | grep -E "error TS|^$" | head -20; echo "Frontend exit: $?"</automated>
  </verify>
  <done>
    Both `npx tsc --noEmit` invocations exit 0 with zero "error TS" lines.
  </done>
</task>

</tasks>

<verification>
1. Backend tsc: `cd backend && npx tsc --noEmit` — exit 0
2. Frontend tsc: `npx tsc --noEmit` — exit 0
3. POST /pairing/generate returns { token, shortCode, qrPayload, expiresAt, totpSecret }
4. POST /pairing/confirm has confirmRateLimit middleware applied
5. GET /pairing/status/:patientId respects ?createdAfter=ISO query param
6. DELETE /pairing/cleanup exists and is admin-only
7. DevicePairingModal has 5 tabs — verify grid-cols-5 in JSX
8. Manual tab: totpCode displayed when session.totpSecret present; shortCode fallback otherwise
9. NFC tab: NDEFWriter check gates the write button; fallback text shown when unsupported
10. BLE tab: navigator.bluetooth check gates scan button; fallback text shown when unsupported
</verification>

<success_criteria>
- tsc --noEmit exits 0 on both frontend (root) and backend
- /pairing/confirm is rate-limited (10 req / 5 min / IP)
- /pairing/generate response includes totpSecret derived from token bytes
- /pairing/confirm accepts totpCode and validates via otplib.authenticator.check
- /pairing/status/:patientId filters by createdAfter when query param present
- DELETE /pairing/cleanup removes expired unused PairingTokens (admin role)
- Manual Code tab shows rotating TOTP with 30s countdown ring (or shortCode fallback)
- NFC Tag tab writes qrPayload to NDEFWriter; shows "NFC not supported" fallback
- Nearby (BLE) tab scans for CardioWatch, connects GATT, writes token; shows BLE fallback
- All errors shown as inline status text within each tab (not toast)
</success_criteria>

<output>
After completion, commit with:
  git add backend/src/routes/pairing.ts src/pilot/components/DevicePairingModal.tsx
  git commit -m "feat(quick-12): multi-strategy pairing — TOTP, NFC, BLE + backend security"

No SUMMARY.md required for quick tasks.
</output>
