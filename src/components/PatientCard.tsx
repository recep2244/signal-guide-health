import { Card } from '@/components/ui/card';
import { TriageBadge } from './TriageBadge';
import { Clock, Activity, Heart } from 'lucide-react';
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-foreground truncate">{patient.name}</h3>
            <TriageBadge level={patient.triageLevel} size="sm" />
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {patient.age}y {patient.gender.charAt(0)} • {patient.condition}
          </p>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
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
        </div>

        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold text-foreground">
            {patient.wellbeingScore}<span className="text-sm text-muted-foreground">/10</span>
          </div>
          <div className="text-xs text-muted-foreground">Wellbeing</div>
        </div>
      </div>

      {patient.alerts.filter(a => !a.resolved).length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-triage-red">
            {patient.alerts.filter(a => !a.resolved).length} unresolved alert{patient.alerts.filter(a => !a.resolved).length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
