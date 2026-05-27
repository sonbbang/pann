import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  label: string;
  value: number | null;
  unit: string;
  loading?: boolean;
  compact?: boolean;
}

export function StatsCard({ label, value, unit, loading = false, compact = false }: StatsCardProps) {
  return (
    <Card className="flex-1 min-w-0" aria-label={label}>
      <CardHeader className={compact ? 'pb-1 px-3 pt-3' : 'pb-2'}>
        <CardTitle className={`font-medium text-muted-foreground leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'px-3 pb-3' : ''} aria-busy={loading}>
        {loading ? (
          <div className={`bg-muted animate-pulse rounded ${compact ? 'h-6' : 'h-8'}`} />
        ) : (
          <p className={`font-bold tabular-nums ${compact ? 'text-xl' : 'text-3xl'}`}>
            {value === null ? '--' : value.toLocaleString('ko-KR')}
            <span className={`font-normal text-muted-foreground ml-1 ${compact ? 'text-xs' : 'text-base'}`}>{unit}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
