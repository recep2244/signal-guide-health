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
    bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  amber: {
    label: 'Review',
    icon: AlertTriangle,
    bgClass: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  red: {
    label: 'Urgent',
    icon: AlertOctagon,
    bgClass: 'bg-red-50 border-red-200 text-red-700',
  },
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-1.5',
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
        'inline-flex items-center font-semibold rounded-full border',
        config.bgClass,
        sizeClasses[size],
        level === 'red' && 'animate-pulse',
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
