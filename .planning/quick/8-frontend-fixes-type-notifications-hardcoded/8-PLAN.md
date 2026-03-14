---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/patient.ts
  - src/hooks/useAdmin.ts
  - src/pilot/pages/Admin.tsx
  - src/pilot/components/PilotDashboardHeader.tsx
  - src/pilot/pages/PatientDetail.tsx
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "Patient type includes whatsappPhone field — no type cast needed in PatientDetail"
    - "Notifications bell calls GET /alerts?resolved=false&limit=10 and renders real alert items"
    - "PatientDetail clinicianName comes from patient.consultant or patient data, not hardcoded string"
    - "Admin usageMetrics reads from useAdminStats hook (GET /admin/stats); shows '--' when data absent"
    - "Frontend tsc --noEmit exits 0 errors after all changes"
  artifacts:
    - path: src/types/patient.ts
      provides: "Patient interface with whatsappPhone?: string"
      contains: "whatsappPhone"
    - path: src/hooks/useAdmin.ts
      provides: "useAdminStats hook — GET /admin/stats"
      exports: ["useAdminStats"]
    - path: src/pilot/pages/Admin.tsx
      provides: "usageMetrics from useAdminStats, with graceful empty/loading state"
    - path: src/pilot/components/PilotDashboardHeader.tsx
      provides: "Bell popover wired to apiClient GET /alerts, real data rendering"
    - path: src/pilot/pages/PatientDetail.tsx
      provides: "clinicianName from patient.consultant (or '--'), type cast removed"
  key_links:
    - from: src/pilot/components/PilotDashboardHeader.tsx
      to: /api/v1/alerts
      via: "apiClient.get('/alerts?resolved=false&limit=10') in useQuery"
      pattern: "apiClient.*alerts"
    - from: src/pilot/pages/Admin.tsx
      to: src/hooks/useAdmin.ts
      via: "useAdminStats() import"
      pattern: "useAdminStats"
    - from: src/pilot/pages/PatientDetail.tsx
      to: src/types/patient.ts
      via: "patient.whatsappPhone direct access (no cast)"
      pattern: "patient\\.whatsappPhone"
---

<objective>
Fix four frontend hardcoding issues: add whatsappPhone to Patient type, wire the notifications bell to
real alerts API, replace hardcoded clinicianName with patient.consultant field, replace hardcoded
usageMetrics object with a real useAdminStats hook.

Purpose: Remove demo data from pilot-facing UI so clinicians see real production data.
Output: 5 files modified, tsc clean, each committed atomically.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Key interfaces the executor needs -->
<interfaces>
From src/types/patient.ts — Patient interface (lines 149-195):
```typescript
export interface Patient {
  id: string;
  name: string;
  // ... (existing fields)
  consultant?: string;       // "Referring consultant" — already present, use for clinicianName
  dischargeFrom?: string;
  // whatsappPhone is NOT yet present — must be added as optional field
}
```

From src/hooks/useAdmin.ts — existing pattern to follow:
```typescript
export function useAdminUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'users', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedUsersResponse>(`/admin/users?page=${page}&limit=${limit}`);
      return res.data;
    },
  });
}
```

From backend GET /alerts response shape:
```typescript
// GET /alerts?resolved=false&limit=10
// Response: { status: 'success', data: { alerts: Alert[], total: number, page: number, limit: number } }
// Each alert includes:
{
  id: string;
  type: string;          // 'vital_signs' | 'missed_checkin' | 'symptom_reported' etc.
  severity: string;      // 'low' | 'medium' | 'high' | 'critical'
  title: string;
  message: string;
  resolved: boolean;
  createdAt: string;     // ISO timestamp
  patientId: string;
  patient: {
    id: string;
    nhsNumber: string;
    user: { firstName: string; lastName: string }
  }
}
```

From backend GET /admin/stats:
```typescript
// Response: { status: 'success', data: { stats: {} } }
// stats is currently empty object — task 7 will fill it, but handle gracefully
```

From Admin.tsx line 89-102 (hardcoded object to replace):
```typescript
const usageMetrics = {
  dailyActiveUsers: 24,
  dailyCheckIns: 342,
  avgResponseTime: "9 min",
  alertsResolved: 156,
  wearablesSynced: 98,
  messagesExchanged: 1247,
  readmissionReduction: 24,
  patientSatisfaction: 92,
  dataPointsCollected: "2.4M",
  apiCalls24h: "48,291",
  storageUsed: "12.4 GB",
  bandwidthUsed: "3.2 GB",
};
```

From PatientDetail.tsx line 95 (type cast to remove):
```typescript
const phone = (patient as { whatsappPhone?: string }).whatsappPhone?.replace(/\D/g, '');
```

From PatientDetail.tsx line 103 (hardcoded clinician):
```typescript
const clinicianName = 'Dr. Sarah Mitchell';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add whatsappPhone to Patient type and fix PatientDetail type cast</name>
  <files>src/types/patient.ts, src/pilot/pages/PatientDetail.tsx</files>
  <action>
    In src/types/patient.ts, add `whatsappPhone?: string;` to the Patient interface after the `avatar?`
    field (around line 164). Add a JSDoc comment: `/** WhatsApp contact number for patient outreach */`.

    In src/pilot/pages/PatientDetail.tsx line 95, replace the type cast:
    ```typescript
    const phone = (patient as { whatsappPhone?: string }).whatsappPhone?.replace(/\D/g, '');
    ```
    with direct access:
    ```typescript
    const phone = patient.whatsappPhone?.replace(/\D/g, '');
    ```
    No other changes to PatientDetail in this task.

    Also in PatientDetail.tsx line 103, replace:
    ```typescript
    const clinicianName = 'Dr. Sarah Mitchell';
    ```
    with:
    ```typescript
    const clinicianName = patient.consultant ?? '--';
    ```
    The `consultant` field is already on the Patient type (it's the "Referring consultant" optional field).
    This single character change removes the hardcoded name. The `pharmacyName` constant on line 104 stays unchanged.

    Commit message: `fix(quick-8): add whatsappPhone to Patient type, use patient.consultant for clinicianName`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30</automated>
  </verify>
  <done>
    Patient interface has whatsappPhone?: string. PatientDetail has no type cast on patient.whatsappPhone.
    clinicianName = patient.consultant ?? '--'. tsc exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add useAdminStats hook and wire Admin.tsx usageMetrics to real API</name>
  <files>src/hooks/useAdmin.ts, src/pilot/pages/Admin.tsx</files>
  <action>
    In src/hooks/useAdmin.ts, add after the existing hooks:

    ```typescript
    interface AdminStats {
      dailyActiveUsers?: number;
      dailyCheckIns?: number;
      avgResponseTime?: string;
      alertsResolved?: number;
      wearablesSynced?: number;
      messagesExchanged?: number;
      readmissionReduction?: number;
      patientSatisfaction?: number;
      dataPointsCollected?: string;
      apiCalls24h?: string;
      storageUsed?: string;
      bandwidthUsed?: string;
    }

    interface AdminStatsResponse {
      status: string;
      data: { stats: AdminStats };
    }

    export function useAdminStats() {
      return useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: async () => {
          const res = await apiClient.get<AdminStatsResponse>('/admin/stats');
          return res.data;
        },
        staleTime: 60_000,
      });
    }
    ```

    In src/pilot/pages/Admin.tsx:
    1. Update the import line (line 69) to add useAdminStats:
       `import { useAdminUsers, useAdminAuditLogs, useAdminStats } from "@/hooks/useAdmin";`

    2. Remove the hardcoded `const usageMetrics = { ... }` block (lines 89-102).

    3. Inside the Admin() component, after the existing useAdminUsers/useAdminAuditLogs calls, add:
       ```typescript
       const { data: statsData } = useAdminStats();
       const stats = statsData?.data?.stats ?? {};
       const usageMetrics = {
         dailyActiveUsers: stats.dailyActiveUsers ?? '--',
         dailyCheckIns: stats.dailyCheckIns ?? '--',
         avgResponseTime: stats.avgResponseTime ?? '--',
         alertsResolved: stats.alertsResolved ?? '--',
         wearablesSynced: stats.wearablesSynced ?? '--',
         messagesExchanged: stats.messagesExchanged ?? '--',
         readmissionReduction: stats.readmissionReduction ?? '--',
         patientSatisfaction: stats.patientSatisfaction ?? '--',
         dataPointsCollected: stats.dataPointsCollected ?? '--',
         apiCalls24h: stats.apiCalls24h ?? '--',
         storageUsed: stats.storageUsed ?? '--',
         bandwidthUsed: stats.bandwidthUsed ?? '--',
       };
       ```
       This preserves the same `usageMetrics` variable name so all downstream JSX references compile without further changes.

    Commit message: `fix(quick-8): useAdminStats hook + Admin.tsx usageMetrics from real /admin/stats`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30</automated>
  </verify>
  <done>
    useAdminStats exported from useAdmin.ts. Admin.tsx imports it, removes hardcoded object, derives
    usageMetrics from API data with '--' fallbacks. tsc exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire notifications bell to real alerts API</name>
  <files>src/pilot/components/PilotDashboardHeader.tsx</files>
  <action>
    PilotDashboardHeader currently receives `unreadAlerts?: number` prop and renders a hardcoded
    3-item list (pt-001, pt-002, pt-003) when unreadAlerts > 0. Replace with a real API call.

    Changes to PilotDashboardHeader.tsx:

    1. Add imports at the top of the file:
       ```typescript
       import { useQuery } from '@tanstack/react-query';
       import apiClient from '@/services/api/client';
       ```

    2. Define the API alert type inside the file (before the component):
       ```typescript
       interface ApiAlert {
         id: string;
         severity: 'low' | 'medium' | 'high' | 'critical';
         title: string;
         message: string;
         createdAt: string;
         patientId: string;
         patient: {
           id: string;
           nhsNumber: string;
           user: { firstName: string; lastName: string };
         };
       }

       interface AlertsResponse {
         status: string;
         data: { alerts: ApiAlert[]; total: number };
       }
       ```

    3. Inside the component function, add the query (before the JSX return):
       ```typescript
       const { data: alertsData } = useQuery({
         queryKey: ['header-alerts'],
         queryFn: async () => {
           const res = await apiClient.get<AlertsResponse>('/alerts?resolved=false&limit=10');
           return res.data;
         },
         staleTime: 30_000,
         retry: false,
       });
       const liveAlerts = alertsData?.data?.alerts ?? [];
       const liveUnreadCount = liveAlerts.length;
       ```

    4. Replace all references to `unreadAlerts` in the JSX with `liveUnreadCount` (the prop is still
       accepted for backward compat but the internal display uses live data).
       - Line 123: `{unreadAlerts > 0 && (` → `{liveUnreadCount > 0 && (`
       - Line 134: `{unreadAlerts > 0 && (` → `{liveUnreadCount > 0 && (`
       - Line 140: `{unreadAlerts > 0 ? (` → `{liveUnreadCount > 0 ? (`

    5. Replace the hardcoded 3-button block (lines 142-181) with a dynamic render:
       ```tsx
       <div className="p-2 space-y-1">
         {liveAlerts.map((alert) => {
           const isCritical = alert.severity === 'critical' || alert.severity === 'high';
           const patientName = `${alert.patient.user.firstName} ${alert.patient.user.lastName}`;
           return (
             <button
               key={alert.id}
               onClick={() => navigate(paths.patient(alert.patientId))}
               className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                 isCritical ? 'hover:bg-red-50' : 'hover:bg-amber-50'
               }`}
             >
               <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                 isCritical ? 'bg-red-100' : 'bg-amber-100'
               }`}>
                 {isCritical
                   ? <AlertCircle size={14} className="text-red-600" />
                   : <AlertTriangle size={14} className="text-amber-600" />}
               </div>
               <div className="min-w-0">
                 <p className={`text-xs font-semibold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                   {alert.title}
                 </p>
                 <p className="text-xs text-slate-600 mt-0.5">{patientName} — {alert.message}</p>
                 <p className="text-[10px] text-slate-400 mt-1">
                   {new Date(alert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                 </p>
               </div>
             </button>
           );
         })}
       </div>
       ```

    Remove the now-unused `CheckCircle2` import only if it is no longer referenced anywhere else in the
    file. Keep `AlertCircle` and `AlertTriangle` (still used).

    Commit message: `fix(quick-8): wire notifications bell to GET /alerts real API`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30</automated>
  </verify>
  <done>
    PilotDashboardHeader imports useQuery + apiClient. Fetches GET /alerts?resolved=false&limit=10.
    Renders real alert items dynamically. No hardcoded pt-001/pt-002/pt-003 references remain.
    tsc exits 0.
  </done>
</task>

</tasks>

<verification>
After all 3 tasks:
- `npx tsc --noEmit -p tsconfig.app.json` exits 0 with no errors
- Grep confirms no hardcoded 'Dr. Sarah Mitchell' string in PatientDetail.tsx
- Grep confirms no hardcoded dailyActiveUsers: 24 in Admin.tsx
- Grep confirms no hardcoded pt-001/pt-002/pt-003 in PilotDashboardHeader.tsx
- `grep -n "whatsappPhone" src/types/patient.ts` shows the field
- `grep -n "useAdminStats" src/hooks/useAdmin.ts` shows the export
</verification>

<success_criteria>
- Patient.whatsappPhone?: string present in type — PatientDetail accesses it directly without cast
- clinicianName derived from patient.consultant ?? '--' in PatientDetail
- useAdminStats hook in useAdmin.ts calls GET /admin/stats; Admin.tsx uses it with '--' fallbacks
- PilotDashboardHeader fetches live alerts, renders them dynamically; hardcoded patients removed
- Frontend TypeScript: tsc --noEmit exits 0 across all changes
- 3 atomic commits, one per task
</success_criteria>

<output>
After completion, create `.planning/quick/8-frontend-fixes-type-notifications-hardcoded/8-SUMMARY.md`
</output>
