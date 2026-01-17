import { memo, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { TriageBadge } from './TriageBadge';
import { Clock, Activity, Heart, Watch } from 'lucide-react';
import type { Patient } from '@/data/mockPatients';
import { cn } from '@/lib/utils';

interface PatientCardProps {
  patient: Patient;
  onClick: () => void;
}

const SPARKLINE_WIDTH = 90;
const SPARKLINE_HEIGHT = 26;

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const PatientCard = memo(function PatientCard({ patient, onClick }: PatientCardProps) {
  // Memoize all calculations to prevent recalculation on every render
  const calculations = useMemo(() => {
    const latestWearable = patient.wearableData[patient.wearableData.length - 1];
    const baselineHR = patient.wearableData.slice(0, 7).reduce((acc, d) => acc + d.restingHR, 0) / 7;
    const hrDelta = Math.round(latestWearable.restingHR - baselineHR);
    const hrSeries = patient.wearableData.slice(-8).map((d) => d.restingHR);
    const minHr = Math.min(...hrSeries);
    const maxHr = Math.max(...hrSeries);
    const sparklinePoints = hrSeries
      .map((value, index) => {
        const x = (SPARKLINE_WIDTH / Math.max(1, hrSeries.length - 1)) * index;
        const normalized = maxHr === minHr ? 0.5 : (value - minHr) / (maxHr - minHr);
        const y = SPARKLINE_HEIGHT - normalized * SPARKLINE_HEIGHT;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const unresolvedCount = patient.alerts.filter(a => !a.resolved).length;

    return {
      latestWearable,
      hrDelta,
      sparklinePoints,
      unresolvedCount,
    };
  }, [patient.wearableData, patient.alerts]);

  const { latestWearable, hrDelta, sparklinePoints, unresolvedCount } = calculations;

  return (
    <Card
      className={cn(
        'card-interactive cursor-pointer p-4 border-l-4',
        patient.triageLevel === 'red' && 'border-l-triage-red',
        patient.triageLevel === 'amber' && 'border-l-triage-amber',
        patient.triageLevel === 'green' && 'border-l-triage-green'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-foreground truncate">{patient.name}</h3>
            <TriageBadge level={patient.triageLevel} size="sm" />
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {patient.age}y {patient.gender.charAt(0)} • {patient.condition}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-4">
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              Last check-in: {formatTime(patient.lastCheckIn)}
            </span>
            <span className="flex items-center gap-1.5">
              <Heart size={12} className={hrDelta > 10 ? 'text-triage-red' : ''} />
              HR: {Math.round(latestWearable.restingHR)} bpm
              {hrDelta !== 0 && (
                <span className={cn(
                  'font-medium',
                  hrDelta > 10 ? 'text-triage-red' : hrDelta > 5 ? 'text-triage-amber' : 'text-muted-foreground'
                )}>
                  ({hrDelta > 0 ? '+' : ''}{hrDelta})
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Activity size={12} />
              {Math.round(latestWearable.steps).toLocaleString()} steps
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Watch size={12} />
              Apple Watch live
            </span>
            <span className="hidden sm:inline">HRV: {Math.round(latestWearable.hrv)} ms</span>
            <span className="hidden sm:inline">Sleep: {latestWearable.sleepHours.toFixed(1)} hrs</span>
            <span>Sync: {formatTime(patient.lastCheckIn)}</span>
            <span className="hidden md:flex items-center gap-2">
              HR trend
              <svg
                width={SPARKLINE_WIDTH}
                height={SPARKLINE_HEIGHT}
                viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                className="block"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={sparklinePoints}
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="text-left shrink-0 sm:text-right">
          <div className="text-2xl font-semibold text-foreground">
            {patient.wellbeingScore}<span className="text-sm text-muted-foreground">/10</span>
          </div>
          <div className="text-xs text-muted-foreground">Wellbeing</div>
        </div>
      </div>

      {unresolvedCount > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-triage-red">
            {unresolvedCount} unresolved alert{unresolvedCount > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </Card>
  );
});
