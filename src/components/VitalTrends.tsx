import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/card';
import { Heart, Activity, Moon, Waves } from 'lucide-react';
import type { WearableReading } from '@/data/mockPatients';
import { cn } from '@/lib/utils';

interface VitalTrendsProps {
  data: WearableReading[];
  className?: string;
}

export function VitalTrends({ data, className }: VitalTrendsProps) {
  // Calculate baselines (first 7 days)
  const baselineData = data.slice(0, 7);
  const baselines = {
    restingHR: Math.round(baselineData.reduce((acc, d) => acc + d.restingHR, 0) / baselineData.length),
    hrv: Math.round(baselineData.reduce((acc, d) => acc + d.hrv, 0) / baselineData.length),
    sleepHours: +(baselineData.reduce((acc, d) => acc + d.sleepHours, 0) / baselineData.length).toFixed(1),
    steps: Math.round(baselineData.reduce((acc, d) => acc + d.steps, 0) / baselineData.length),
  };

  // Get latest values
  const latest = data[data.length - 1];
  const latestValues = {
    restingHR: Math.round(latest.restingHR),
    hrv: Math.round(latest.hrv),
    sleepHours: +latest.sleepHours.toFixed(1),
    steps: Math.round(latest.steps),
  };

  // Calculate deltas
  const deltas = {
    restingHR: latestValues.restingHR - baselines.restingHR,
    hrv: latestValues.hrv - baselines.hrv,
    sleepHours: +(latestValues.sleepHours - baselines.sleepHours).toFixed(1),
    steps: latestValues.steps - baselines.steps,
  };

  const chartData = data.map((d, i) => ({
    day: i + 1,
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    restingHR: Math.round(d.restingHR),
    hrv: Math.round(d.hrv),
    sleepHours: +d.sleepHours.toFixed(1),
    steps: Math.round(d.steps),
  }));

  const metrics = [
    {
      key: 'restingHR',
      label: 'Resting HR',
      value: latestValues.restingHR,
      unit: 'bpm',
      baseline: baselines.restingHR,
      delta: deltas.restingHR,
      icon: Heart,
      color: 'hsl(var(--chart-hr))',
      isInverse: true, // Higher is worse
    },
    {
      key: 'hrv',
      label: 'HRV',
      value: latestValues.hrv,
      unit: 'ms',
      baseline: baselines.hrv,
      delta: deltas.hrv,
      icon: Waves,
      color: 'hsl(var(--chart-hrv))',
      isInverse: false, // Lower is worse
    },
    {
      key: 'sleepHours',
      label: 'Sleep',
      value: latestValues.sleepHours,
      unit: 'hrs',
      baseline: baselines.sleepHours,
      delta: deltas.sleepHours,
      icon: Moon,
      color: 'hsl(var(--chart-sleep))',
      isInverse: false,
    },
    {
      key: 'steps',
      label: 'Steps',
      value: latestValues.steps.toLocaleString(),
      unit: '',
      baseline: baselines.steps,
      delta: deltas.steps,
      icon: Activity,
      color: 'hsl(var(--chart-activity))',
      isInverse: false,
    },
  ];

  const getDeltaColor = (delta: number, isInverse: boolean) => {
    const threshold = isInverse ? { warn: 10, danger: 15 } : { warn: -20, danger: -30 };
    if (isInverse) {
      if (delta >= threshold.danger) return 'text-triage-red';
      if (delta >= threshold.warn) return 'text-triage-amber';
      return 'text-triage-green';
    } else {
      if (delta <= threshold.danger) return 'text-triage-red';
      if (delta <= threshold.warn) return 'text-triage-amber';
      return 'text-triage-green';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const deltaColor = getDeltaColor(
            metric.key === 'steps' ? deltas.steps / 100 : metric.delta,
            metric.isInverse
          );

          return (
            <Card key={metric.key} className="vital-card">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="p-1.5 rounded-lg" 
                  style={{ backgroundColor: `${metric.color}20` }}
                >
                  <Icon size={14} style={{ color: metric.color }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold">{metric.value}</span>
                <span className="text-xs text-muted-foreground">{metric.unit}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={cn('text-xs font-medium', deltaColor)}>
                  {metric.delta > 0 ? '+' : ''}{metric.key === 'steps' ? metric.delta.toLocaleString() : metric.delta}
                </span>
                <span className="text-xs text-muted-foreground">vs baseline</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h4 className="text-sm font-medium mb-4">14-Day Trends</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval={2}
              />
              <YAxis 
                yAxisId="hr"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine 
                yAxisId="hr"
                y={baselines.restingHR} 
                stroke="hsl(var(--chart-hr))" 
                strokeDasharray="4 4" 
                strokeOpacity={0.5}
              />
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="restingHR"
                stroke="hsl(var(--chart-hr))"
                strokeWidth={2}
                dot={false}
                name="HR (bpm)"
              />
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="hrv"
                stroke="hsl(var(--chart-hrv))"
                strokeWidth={2}
                dot={false}
                name="HRV (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-hr))' }} />
            <span className="text-xs text-muted-foreground">Resting HR</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-hrv))' }} />
            <span className="text-xs text-muted-foreground">HRV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded border-dashed border-t-2" style={{ borderColor: 'hsl(var(--chart-hr))' }} />
            <span className="text-xs text-muted-foreground">Baseline</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
