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
      bgClass: 'bg-teal-50 border-2 border-teal-100',
      textClass: 'text-teal-700',
      activeClass: 'ring-2 ring-teal-500 ring-offset-2',
      iconColor: 'text-teal-600',
    },
    {
      key: 'red' as const,
      label: 'Urgent',
      count: stats.red,
      icon: AlertOctagon,
      bgClass: 'bg-red-50 border-2 border-red-100',
      textClass: 'text-red-700',
      activeClass: 'ring-2 ring-red-500 ring-offset-2',
      iconColor: 'text-red-600',
    },
    {
      key: 'amber' as const,
      label: 'Review Today',
      count: stats.amber,
      icon: AlertTriangle,
      bgClass: 'bg-amber-50 border-2 border-amber-100',
      textClass: 'text-amber-700',
      activeClass: 'ring-2 ring-amber-500 ring-offset-2',
      iconColor: 'text-amber-600',
    },
    {
      key: 'green' as const,
      label: 'Stable',
      count: stats.green,
      icon: CheckCircle,
      bgClass: 'bg-emerald-50 border-2 border-emerald-100',
      textClass: 'text-emerald-700',
      activeClass: 'ring-2 ring-emerald-500 ring-offset-2',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.key;

        return (
          <Card
            key={card.key}
            className={cn(
              'p-5 cursor-pointer transition-all duration-200 rounded-xl shadow-sm',
              card.bgClass,
              isActive && card.activeClass,
              'hover:scale-[1.02] hover:shadow-md'
            )}
            onClick={() => onFilterChange(card.key)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
                <Icon size={20} className={card.iconColor} />
              </div>
              <span className={cn('text-3xl font-bold', card.textClass)}>
                {card.count}
              </span>
            </div>
            <p className={cn('text-sm font-semibold', card.textClass)}>
              {card.label}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
