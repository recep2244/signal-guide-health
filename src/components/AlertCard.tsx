import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertOctagon, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import type { Alert } from '@/data/mockPatients';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert;
  onResolve?: (alertId: string) => void;
  className?: string;
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AlertCard = memo(function AlertCard({ alert, onResolve, className }: AlertCardProps) {
  const isRed = alert.type === 'red';

  return (
    <Card
      className={cn(
        'p-4 border-l-4',
        isRed ? 'border-l-triage-red bg-triage-red-bg/30' : 'border-l-triage-amber bg-triage-amber-bg/30',
        alert.resolved && 'opacity-60',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 p-2 rounded-lg',
            isRed ? 'bg-triage-red-bg' : 'bg-triage-amber-bg'
          )}
        >
          {isRed ? (
            <AlertOctagon size={18} className="text-triage-red" />
          ) : (
            <AlertTriangle size={18} className="text-triage-amber" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={cn(
                'text-sm font-semibold',
                isRed ? 'text-triage-red-foreground' : 'text-triage-amber-foreground'
              )}
            >
              {alert.headline}
            </h4>
            {alert.resolved && (
              <span className="inline-flex items-center gap-1 text-xs text-triage-green font-medium">
                <CheckCircle size={12} />
                Resolved
              </span>
            )}
          </div>

          <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
            {alert.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} />
              {formatTime(alert.timestamp)}
            </span>

            {!alert.resolved && onResolve && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolve(alert.id)}
                className="text-xs h-7"
              >
                Mark Resolved
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
