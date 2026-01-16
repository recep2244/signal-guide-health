import { Card } from '@/components/ui/card';
import type { SBARSummary } from '@/data/mockPatients';
import { cn } from '@/lib/utils';

interface SBARCardProps {
  sbar: SBARSummary;
  className?: string;
}

const sbarSections = [
  { key: 'situation', label: 'S', title: 'Situation', color: 'bg-primary' },
  { key: 'background', label: 'B', title: 'Background', color: 'bg-chart-hrv' },
  { key: 'assessment', label: 'A', title: 'Assessment', color: 'bg-chart-sleep' },
  { key: 'recommendation', label: 'R', title: 'Recommendation', color: 'bg-chart-activity' },
] as const;

export function SBARCard({ sbar, className }: SBARCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <h3 className="text-sm font-semibold mb-4 text-foreground">Clinical Summary (SBAR)</h3>
      <div className="space-y-4">
        {sbarSections.map((section) => (
          <div key={section.key} className="flex gap-3">
            <div
              className={cn(
                'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground',
                section.color
              )}
              style={section.color.startsWith('bg-chart') ? {
                backgroundColor: `hsl(var(--chart-${section.color.replace('bg-chart-', '')}))`
              } : undefined}
            >
              {section.label}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-muted-foreground mb-0.5">
                {section.title}
              </h4>
              <p className="text-sm text-foreground leading-relaxed">
                {sbar[section.key]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
