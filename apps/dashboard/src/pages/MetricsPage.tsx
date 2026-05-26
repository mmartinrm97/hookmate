import { useQuery } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import {
  DeliveryLatencyChart,
  ErrorRateChart,
  MetricsCards,
  QueueDepthChart,
  StatusPieChart,
} from '../components/metrics/index';
import { useQueueDepthSse } from '../hooks/use-queue-depth-sse';
import { Select, SelectItem } from '../components/ui/select';
import { metricsApi } from '../lib/api';

export function MetricsPage(): JSX.Element {
  const [timeRange, setTimeRange] = useState('24');
  const { depth: liveDepth, connected: sseConnected } = useQueueDepthSse();

  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ['metrics', 'snapshot'],
    queryFn: metricsApi.getSnapshot,
    refetchInterval: 30_000,
  });

  const { data: queueDepth, isLoading: queueLoading } = useQuery({
    queryKey: ['metrics', 'queue-depth', timeRange],
    queryFn: () => metricsApi.getQueueDepth(Number(timeRange)),
    refetchInterval: 30_000,
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['metrics', 'events-by-status'],
    queryFn: metricsApi.getEventsByStatus,
    refetchInterval: 30_000,
  });

  const { data: latencyData, isLoading: latencyLoading } = useQuery({
    queryKey: ['metrics', 'latency', timeRange],
    queryFn: () => metricsApi.getLatency(Number(timeRange)),
    refetchInterval: 30_000,
  });

  const { data: errorRateData, isLoading: errorLoading } = useQuery({
    queryKey: ['metrics', 'error-rate', timeRange],
    queryFn: () => metricsApi.getErrorRate(Number(timeRange)),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
            {sseConnected && liveDepth != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live: {liveDepth.visible} pending
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            System-wide performance and health metrics.
          </p>
        </div>
        <Select
          value={timeRange}
          onValueChange={setTimeRange}
          aria-label="Time range"
          className="w-36"
        >
          <SelectItem value="1">Last hour</SelectItem>
          <SelectItem value="6">Last 6 hours</SelectItem>
          <SelectItem value="24">Last 24 hours</SelectItem>
          <SelectItem value="168">Last 7 days</SelectItem>
        </Select>
      </div>

      <MetricsCards snapshot={snapshot} isLoading={snapshotLoading} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <QueueDepthChart data={queueDepth} isLoading={queueLoading} />
        <StatusPieChart data={statusData} isLoading={statusLoading} />
        <DeliveryLatencyChart data={latencyData} isLoading={latencyLoading} />
        <ErrorRateChart data={errorRateData} isLoading={errorLoading} />
      </div>
    </div>
  );
}
