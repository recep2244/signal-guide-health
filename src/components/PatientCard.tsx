import { Card } from '@/components/ui/card';
import { TriageBadge } from './TriageBadge';
import { Clock, Activity, Heart, Watch, ChevronRight } from 'lucide-react';
import type { Patient } from '@/data/mockPatients';
import { cn } from '@/lib/utils';

interface PatientCardProps {
  patient: Patient;
  onClick: () => void;
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const latestWearable = patient.wearableData[patient.wearableData.length - 1];
  const baselineHR = patient.wearableData.slice(0, 7).reduce((acc, d) => acc + d.restingHR, 0) / 7;
  const hrDelta = Math.round(latestWearable.restingHR - baselineHR);
  const hrSeries = patient.wearableData.slice(-8).map((d) => d.restingHR);
  const minHr = Math.min(...hrSeries);
  const maxHr = Math.max(...hrSeries);
  const sparklineWidth = 90;
  const sparklineHeight = 26;
  const sparklinePoints = hrSeries
    .map((value, index) => {
      const x = (sparklineWidth / Math.max(1, hrSeries.length - 1)) * index;
      const normalized = maxHr === minHr ? 0.5 : (value - minHr) / (maxHr - minHr);
      const y = sparklineHeight - normalized * sparklineHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getTriageBorderClass = () => {
    switch (patient.triageLevel) {
      case 'red': return 'border-l-red-500';
      case 'amber': return 'border-l-amber-500';
      case 'green': return 'border-l-emerald-500';
      default: return 'border-l-slate-300';
    }
  };

  const getTriageBgClass = () => {
    switch (patient.triageLevel) {
      case 'red': return 'bg-red-50/30 hover:bg-red-50/50';
      case 'amber': return 'bg-amber-50/30 hover:bg-amber-50/50';
      case 'green': return 'bg-emerald-50/30 hover:bg-emerald-50/50';
      default: return 'bg-white hover:bg-slate-50';
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer p-5 border-l-4 border-2 border-slate-200 rounded-xl transition-all duration-200 hover:shadow-lg group',
        getTriageBorderClass(),
        getTriageBgClass()
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-bold text-slate-900 truncate text-base">{patient.name}</h3>
            <TriageBadge level={patient.triageLevel} size="sm" />
          </div>

          <p className="text-sm text-slate-500 mb-3">
            {patient.age}y {patient.gender.charAt(0)} • {patient.condition}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:flex sm:flex-wrap sm:gap-4">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              Last check-in: {formatTime(patient.lastCheckIn)}
            </span>
            <span className="flex items-center gap-1.5">
              <Heart size={13} className={hrDelta > 10 ? 'text-red-500' : 'text-slate-400'} />
              HR: {Math.round(latestWearable.restingHR)} bpm
              {hrDelta !== 0 && (
                <span className={cn(
                  'font-semibold',
                  hrDelta > 10 ? 'text-red-600' : hrDelta > 5 ? 'text-amber-600' : 'text-slate-500'
                )}>
                  ({hrDelta > 0 ? '+' : ''}{hrDelta})
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Activity size={13} className="text-slate-400" />
              {Math.round(latestWearable.steps).toLocaleString()} steps
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-full">
              <Watch size={12} className="text-teal-600" />
              Apple Watch
            </span>
            <span className="hidden sm:inline bg-slate-100 px-2 py-1 rounded-full">HRV: {Math.round(latestWearable.hrv)} ms</span>
            <span className="hidden sm:inline bg-slate-100 px-2 py-1 rounded-full">Sleep: {latestWearable.sleepHours.toFixed(1)} hrs</span>
            <span className="hidden md:flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-full">
              HR trend
              <svg
                width={sparklineWidth}
                height={sparklineHeight}
                viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
                className="block"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={sparklinePoints}
                  className="text-teal-600"
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left shrink-0 sm:text-right bg-white/80 px-4 py-2 rounded-xl border border-slate-200">
            <div className="text-2xl font-bold text-slate-900">
              {patient.wellbeingScore}<span className="text-sm font-medium text-slate-400">/10</span>
            </div>
            <div className="text-xs font-medium text-slate-500">Wellbeing</div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-teal-500 transition-colors hidden sm:block" />
        </div>
      </div>

      {patient.alerts.filter(a => !a.resolved).length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {patient.alerts.filter(a => !a.resolved).length} unresolved alert{patient.alerts.filter(a => !a.resolved).length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
