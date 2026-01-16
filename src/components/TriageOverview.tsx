import { Card } from '@/components/ui/card';
import { AlertOctagon, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TriageOverviewProps {
  stats: {
    red: number;
    amber: number;
    green: number;
    total: number;
  };
  activeFilter: 'all' | 'red' | 'amber' | 'green';
  onFilterChange: (filter: 'all' | 'red' | 'amber' | 'green') => void;
}

export function TriageOverview({ stats, activeFilter, onFilterChange }: TriageOverviewProps) {
  const cards = [
    {
      key: 'all' as const,
      label: 'All Patients',
      count: stats.total,
      icon: Users,
      bgClass: 'bg-secondary',
      textClass: 'text-secondary-foreground',
      activeClass: 'ring-2 ring-primary ring-offset-2',
    },
    {
      key: 'red' as const,
      label: 'Urgent',
      count: stats.red,
      icon: AlertOctagon,
      bgClass: 'bg-triage-red-bg',
      textClass: 'text-triage-red-foreground',
      activeClass: 'ring-2 ring-triage-red ring-offset-2',
      iconColor: 'text-triage-red',
    },
    {
      key: 'amber' as const,
      label: 'Review Today',
      count: stats.amber,
      icon: AlertTriangle,
      bgClass: 'bg-triage-amber-bg',
      textClass: 'text-triage-amber-foreground',
      activeClass: 'ring-2 ring-triage-amber ring-offset-2',
      iconColor: 'text-triage-amber',
    },
    {
      key: 'green' as const,
      label: 'Stable',
      count: stats.green,
      icon: CheckCircle,
      bgClass: 'bg-triage-green-bg',
      textClass: 'text-triage-green-foreground',
      activeClass: 'ring-2 ring-triage-green ring-offset-2',
      iconColor: 'text-triage-green',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.key;

        return (
          <Card
            key={card.key}
            className={cn(
              'p-4 cursor-pointer transition-all duration-200',
              card.bgClass,
              isActive && card.activeClass,
              'hover:scale-[1.02]'
            )}
            onClick={() => onFilterChange(card.key)}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon size={20} className={card.iconColor || card.textClass} />
              <span className={cn('text-2xl font-bold', card.textClass)}>
                {card.count}
              </span>
            </div>
            <p className={cn('text-xs font-medium', card.textClass, 'opacity-80')}>
              {card.label}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
