import { type JSX } from 'react';
import type { MetricsSnapshot } from '../../types/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Skeleton } from '../ui/skeleton.js';
import { formatNumber, formatLatency, formatPercent } from '../../lib/utils.js';
import { cn } from '../../lib/cn.js';

interface MetricsCardsProps {
  snapshot: MetricsSnapshot | undefined;
  isLoading: boolean;
}

export function MetricsCards({ snapshot, isLoading }: MetricsCardsProps): JSX.Element | null {
  if (isLoading) return <MetricsCardsSkeleton />;

  if (!snapshot) return null;

  const cards = [
    {
      title: 'Queue Depth',
      value: formatNumber(snapshot.queueDepth),
      description: 'Messages waiting in queue',
      trend:
        snapshot.queueDepth > 100
          ? ('warning' as const)
          : snapshot.queueDepth > 10
            ? ('neutral' as const)
            : ('good' as const),
    },
    {
      title: 'Error Rate',
      value: formatPercent(snapshot.errorRate),
      description: 'Of total events',
      trend: snapshot.errorRate > 0.05 ? ('warning' as const) : ('good' as const),
    },
    {
      title: 'Throughput',
      value: `${formatNumber(snapshot.throughput)}/s`,
      description: 'Events per second',
      trend: 'neutral' as const,
    },
    {
      title: 'P99 Latency',
      value: formatLatency(snapshot.latencyMs.p99),
      description: 'Worst-case delivery time',
      trend: snapshot.latencyMs.p99 > 5000 ? ('warning' as const) : ('good' as const),
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-2xl font-bold',
                  card.trend === 'warning' && 'text-destructive',
                  card.trend === 'good' && 'text-emerald-500',
                )}
              >
                {card.value}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MetricsCardsSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
