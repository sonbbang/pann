import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  label: string;
  value: number | null;
  unit: string;
  loading?: boolean;
}

export function StatsCard({ label, value, unit, loading = false }: StatsCardProps) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-3xl font-bold">
            {value === null ? '--' : value.toLocaleString('ko-KR')}
            <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
