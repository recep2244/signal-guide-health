# Signal Guide Health (CardioWatch)

A clinical dashboard concept for post-discharge cardiac monitoring. CardioWatch helps care teams triage patients using AI-powered wearable signal analysis combined with clinician-first triage automation.

**Developed by Recep Adiyaman**

## Problem & Solution

**Problem:** High-cost hospital readmissions within the first 30 days post-discharge represent a significant financial and clinical burden.

**Solution:** AI-powered wearable signal analysis (Apple Watch, Fitbit) combined with daily patient check-ins and automated triage, enabling proactive intervention before readmission is necessary.

## Features

### Clinician Dashboard
- Triage overview with red/amber/green priority queues
- Patient cards with sparkline vital trends
- Alert management with resolution tracking
- SBAR clinical summaries for handoff
- 14-day vital trend visualization

### Patient Demo
- WhatsApp-style daily check-in flow
- Symptom screening with smart routing
- Wearable data integration display
- Quick actions (appointment, refill, call clinician)
- Multi-path conversation flows (urgent, concern, normal)

### Technical Features
- Deterministic mock data for repeatable demos
- LocalStorage persistence for alert resolution
- Error boundaries for graceful failure handling
- Fully typed with TypeScript

## Architecture

```
src/
├── config/              # Configuration & constants
│   ├── constants.ts     # App-wide config values
│   └── flows.ts         # Patient demo conversation flows
├── types/               # TypeScript type definitions
│   ├── patient.ts       # Patient, Alert, Wearable types
│   └── index.ts         # Type exports
├── context/             # React Context providers
│   └── AlertsContext.tsx # Alert state with localStorage
├── hooks/               # Custom React hooks
│   ├── usePatientFlow.ts # Patient demo state machine
│   ├── use-mobile.tsx    # Mobile detection
│   └── use-toast.ts      # Toast notifications
├── data/                # Mock data layer
│   └── mockPatients.ts   # Deterministic patient data
├── components/          # UI components
│   ├── ErrorBoundary.tsx # Error handling
│   ├── PatientCard.tsx   # Dashboard patient card
│   ├── AlertCard.tsx     # Alert display
│   ├── VitalTrends.tsx   # Vital charts
│   ├── SBARCard.tsx      # Clinical summary
│   └── ui/               # shadcn/ui components
├── pages/               # Route pages
│   ├── Landing.tsx       # Marketing/investor page
│   ├── Dashboard.tsx     # Clinician triage view
│   ├── PatientDetail.tsx # Individual patient view
│   ├── PatientDemo.tsx   # Patient check-in demo
│   └── NotFound.tsx      # 404 page
└── App.tsx              # Root component with routing
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Build | Vite |
| Language | TypeScript 5.8 |
| Framework | React 18 |
| Routing | React Router 6 |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | React Context + React Query |
| Forms | React Hook Form + Zod |
| Testing | Vitest + Testing Library |

## Getting Started

```sh
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Configuration

Key configuration values are centralized in `src/config/constants.ts`:

- **Timing**: Agent typing delays, animation durations
- **Clinical Thresholds**: HR/HRV alert thresholds, baseline periods
- **Storage Keys**: LocalStorage key names
- **API Settings**: Timeout, retry counts, cache duration

## State Management

### AlertsContext
Manages resolved alert IDs with localStorage persistence:
- `resolveAlert(id)` - Mark alert as resolved
- `unresolveAlert(id)` - Undo resolution
- `clearResolvedAlerts()` - Clear all
- `isAlertResolved(id)` - Check status

### usePatientFlow Hook
State machine for patient demo conversation:
- Manages multi-path flows (normal, urgent, concern, etc.)
- Handles option selection routing
- Provides typing indicators

## Testing

```sh
# Run all tests
npm run test

# Watch mode
npm run test:watch
```

Test files:
- `src/test/Dashboard.test.tsx` - Dashboard rendering
- `src/test/mockPatients.test.ts` - Data helper functions

## Deployment

The project is configured for GitHub Pages deployment via `.github/workflows/deploy.yml`.

Build output is configured with base URL: `/signal-guide-health/`

## Business Model

- **Revenue**: SaaS + per-patient pricing
- **Target**: Hospital systems managing post-cardiac discharge patients
- **Value Proposition**: Reduce 30-day readmissions through proactive monitoring

## Notes

- Demo data is synthetic and for product exploration only
- Seeded random generation ensures consistent demo presentations
- All patient scenarios are fictional

## Copyright

This demo and its assets are curated and developed by Recep Adiyaman.
All visuals, narrative flows, and interface compositions are original work
prepared for investor presentations. Distribution or reuse requires permission.
