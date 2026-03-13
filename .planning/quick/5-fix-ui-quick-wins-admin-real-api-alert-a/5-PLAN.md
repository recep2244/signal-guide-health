---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/admin.ts
  - src/hooks/useAdmin.ts
  - src/pilot/pages/Admin.tsx
  - src/pilot/pages/PatientDetail.tsx
autonomous: true
requirements:
  - ADMIN-USERS-API
  - ADMIN-AUDIT-API
  - ADMIN-REAL-DATA
  - ALERT-ACKNOWLEDGE
  - LIVE-SYNC-MODAL
  - CONTACT-WHATSAPP

must_haves:
  truths:
    - "GET /api/v1/admin/users returns paginated users from prisma (not empty array)"
    - "GET /api/v1/admin/audit-logs returns paginated audit logs from prisma (not empty array)"
    - "Admin.tsx user table and audit log table show live data with loading/error states"
    - "Acknowledge Alert button calls PATCH /api/v1/alerts/:alertId/acknowledge and invalidates query"
    - "Request Live Sync button calls POST /api/v1/pairing/generate and opens DevicePairingModal with token"
    - "Contact Patient button opens WhatsApp wa.me link in new tab"
  artifacts:
    - path: "backend/src/routes/admin.ts"
      provides: "GET /users and GET /audit-logs with real Prisma queries"
    - path: "src/hooks/useAdmin.ts"
      provides: "useAdminUsers and useAdminAuditLogs React Query hooks"
    - path: "src/pilot/pages/Admin.tsx"
      provides: "Live user/audit data replacing mock arrays"
    - path: "src/pilot/pages/PatientDetail.tsx"
      provides: "Wired Acknowledge/LiveSync/Contact buttons"
  key_links:
    - from: "src/pilot/pages/Admin.tsx"
      to: "src/hooks/useAdmin.ts"
      via: "useAdminUsers(), useAdminAuditLogs() imports"
    - from: "src/hooks/useAdmin.ts"
      to: "/api/v1/admin/users and /api/v1/admin/audit-logs"
      via: "apiClient.get"
    - from: "src/pilot/pages/PatientDetail.tsx"
      to: "/api/v1/alerts/:id/acknowledge"
      via: "apiClient.patch in handleAcknowledgeAlert"
    - from: "src/pilot/pages/PatientDetail.tsx"
      to: "/api/v1/pairing/generate"
      via: "apiClient.post in handleRequestLiveSync"
---

<objective>
Wire Admin page and PatientDetail page to real backend data and real actions instead of mocks/toasts.

Purpose: Pilot demo credibility — admin sees actual users/logs, clinicians can acknowledge alerts and trigger live sync properly.
Output: 2 backend stubs replaced with Prisma queries; 1 new hook file; Admin.tsx and PatientDetail.tsx updated.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire admin.ts stubs to real Prisma queries</name>
  <files>backend/src/routes/admin.ts</files>
  <action>
Replace the two stub handlers at lines 124-130 with real implementations:

GET /users (line 124-126):
```typescript
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    res.json({ status: 'success', data: { users, total, page, limit } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch users', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});
```

GET /audit-logs (line 128-130):
```typescript
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ status: 'success', data: { logs, total, page, limit } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch audit logs', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit logs' });
  }
});
```

Do NOT change any other handlers. Check that `prisma` and `logger` are already imported (they are at lines 9 and 13).
  </action>
  <verify>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -E "admin\.ts" || echo "no admin.ts errors"</verify>
  <done>GET /users and GET /audit-logs query prisma instead of returning empty arrays; tsc --noEmit passes for admin.ts</done>
</task>

<task type="auto">
  <name>Task 2: Create useAdmin.ts hook and update Admin.tsx to use live data</name>
  <files>src/hooks/useAdmin.ts, src/pilot/pages/Admin.tsx</files>
  <action>
CREATE src/hooks/useAdmin.ts:

```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api/client';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  timestamp: string;
  ipAddress: string | null;
  oldValues: unknown;
  newValues: unknown;
}

interface PaginatedResponse<T> {
  data: { [key: string]: T[]; total: number; page: number; limit: number };
}

export function useAdminUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'users', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<AdminUser>>(
        `/admin/users?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}

export function useAdminAuditLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<AuditLog>>(
        `/admin/audit-logs?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}
```

UPDATE src/pilot/pages/Admin.tsx:
1. Add imports at top: `import { useAdminUsers, useAdminAuditLogs } from '@/hooks/useAdmin';`
2. Locate the `mockUsers` array (search for `const mockUsers`) — replace it and its usage in the users table with:
   - `const { data: usersData, isLoading: usersLoading, error: usersError } = useAdminUsers();`
   - `const adminUsers = usersData?.data?.users ?? [];`
   - In the users table section, wrap with: `{usersLoading && <p className="text-sm text-muted-foreground p-4">Loading users...</p>}` and `{usersError && <p className="text-sm text-destructive p-4">Failed to load users</p>}`
   - Replace `mockUsers.map(...)` with `adminUsers.map((user) => ...)` — update field references to match AdminUser shape (id, email, name, role, createdAt)
3. Locate the `mockAuditLogs` array — replace it and its usage in the audit logs table with:
   - `const { data: auditData, isLoading: auditLoading, error: auditError } = useAdminAuditLogs();`
   - `const auditLogs = auditData?.data?.logs ?? [];`
   - Same loading/error wrappers
   - Replace `mockAuditLogs.map(...)` with `auditLogs.map((log) => ...)` — update field references to match AuditLog shape
4. Add comment `// TODO: replace with real backend endpoint when available` above any remaining mockHospitals or integration steps static arrays — do NOT remove those arrays.
5. Remove the mock array const declarations for mockUsers and mockAuditLogs.

Keep all existing UI structure, styling, and tab layout intact. Only replace data sources.
  </action>
  <verify>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | grep -E "useAdmin|Admin\.tsx" || echo "no hook/admin errors"</verify>
  <done>useAdmin.ts exists with two exported hooks; Admin.tsx imports and uses them; mockUsers/mockAuditLogs const declarations removed; loading/error states present; tsc passes</done>
</task>

<task type="auto">
  <name>Task 3: Wire PatientDetail 3 buttons — Acknowledge Alert, Request Live Sync, Contact Patient</name>
  <files>src/pilot/pages/PatientDetail.tsx</files>
  <action>
Three targeted changes to PatientDetail.tsx. Do NOT restructure the component.

1. ADD import at top (with existing imports):
```typescript
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
```

2. ADD inside the component function, after the existing useState declarations:
```typescript
const queryClient = useQueryClient();
```

3. REPLACE handleResolveAlert (lines 71-74) — this is the "Acknowledge Alert" handler — with:
```typescript
const handleResolveAlert = async (alertId: string) => {
  try {
    await apiClient.patch(`/alerts/${alertId}/acknowledge`);
    resolveAlert(alertId);
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    toast.success('Alert acknowledged');
  } catch {
    // Optimistically update local state even if API fails
    resolveAlert(alertId);
    toast.success('Alert marked as resolved');
  }
};
```

4. REPLACE handleRequestLiveSync (lines 122-124) with:
```typescript
const handleRequestLiveSync = async () => {
  try {
    const res = await apiClient.post<{
      data: { token: string; shortCode: string; qrPayload: string };
    }>('/pairing/generate', { patientId: patientId || '' });
    const { token, shortCode, qrPayload } = res.data.data;
    setPairingToken(token);
    setPairingShortCode(shortCode);
    setPairingQrPayload(qrPayload);
    setPairingOpen(true);
  } catch {
    toast.error('Failed to request live sync');
  }
};
```

5. ADD three new useState declarations alongside the existing `const [pairingOpen, setPairingOpen] = useState(false);`:
```typescript
const [pairingToken, setPairingToken] = useState<string | undefined>(undefined);
const [pairingShortCode, setPairingShortCode] = useState<string | undefined>(undefined);
const [pairingQrPayload, setPairingQrPayload] = useState<string | undefined>(undefined);
```

6. REPLACE handleContactPatient (lines 80-82) with:
```typescript
const handleContactPatient = () => {
  const phone = patient.whatsappPhone?.replace(/\D/g, '');
  if (phone) {
    window.open(`https://wa.me/${phone}`, '_blank');
  } else {
    toast.info('No WhatsApp number on file for this patient');
  }
};
```

7. UPDATE the DevicePairingModal at the bottom of the JSX to pass the new props:
```typescript
<DevicePairingModal
  open={pairingOpen}
  onOpenChange={setPairingOpen}
  patientId={patientId || ''}
  initialToken={pairingToken}
  initialShortCode={pairingShortCode}
  initialQrPayload={pairingQrPayload}
/>
```

Note: If DevicePairingModal does not accept initialToken/initialShortCode/initialQrPayload props in its current interface, add them as optional props (type `string | undefined`) to the component's Props interface in src/pilot/components/DevicePairingModal.tsx — use them as initial state if provided. Check the file first before deciding whether to add props.
  </action>
  <verify>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | grep -E "PatientDetail|DevicePairing" || echo "no PatientDetail errors"</verify>
  <done>handleResolveAlert calls PATCH /alerts/:id/acknowledge; handleRequestLiveSync calls POST /pairing/generate and opens modal with token data; handleContactPatient opens wa.me link; tsc passes with no new errors</done>
</task>

</tasks>

<verification>
Run from project root:
```bash
cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health
npx tsc --noEmit 2>&1 | tail -5
cd backend && npx tsc --noEmit 2>&1 | tail -5
```
Both must exit with no errors related to the changed files.
</verification>

<success_criteria>
- GET /api/v1/admin/users queries prisma.user with pagination (not stub empty array)
- GET /api/v1/admin/audit-logs queries prisma.auditLog with pagination (not stub empty array)
- Admin.tsx user and audit log tables driven by useAdminUsers/useAdminAuditLogs with loading/error states
- PatientDetail Acknowledge Alert → PATCH /api/v1/alerts/:id/acknowledge + invalidates query
- PatientDetail Request Live Sync → POST /api/v1/pairing/generate → opens DevicePairingModal with token
- PatientDetail Contact Patient → window.open(wa.me/[phone], '_blank')
- Frontend and backend tsc --noEmit pass with zero new errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-fix-ui-quick-wins-admin-real-api-alert-a/5-SUMMARY.md`
</output>
