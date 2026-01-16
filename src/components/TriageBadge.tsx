import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import type { TriageLevel } from '@/data/mockPatients';

interface TriageBadgeProps {
  level: TriageLevel;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const triageConfig = {
  green: {
    label: 'Stable',
    icon: CheckCircle,
    className: 'triage-badge-green',
  },
  amber: {
    label: 'Review',
    icon: AlertTriangle,
    className: 'triage-badge-amber',
  },
  red: {
    label: 'Urgent',
    icon: AlertOctagon,
    className: 'triage-badge-red',
  },
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

const iconSizes = {
  sm: 10,
  md: 12,
  lg: 14,
};

export function TriageBadge({ level, showIcon = true, size = 'md', className }: TriageBadgeProps) {
  const config = triageConfig[level];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'triage-badge',
        config.className,
        sizeClasses[size],
        level === 'red' && 'animate-pulse-subtle',
        className
      )}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </span>
  );
}

interface StatusDotProps {
  level: TriageLevel;
  className?: string;
}

export function StatusDot({ level, className }: StatusDotProps) {
  const dotClasses = {
    green: 'status-dot-green',
    amber: 'status-dot-amber',
    red: 'status-dot-red',
  };

  return <span className={cn('status-dot', dotClasses[level], className)} />;
}
