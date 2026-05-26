import { useQuery } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import {
  DeliveryLatencyChart,
  ErrorRateChart,
  MetricsCards,
  QueueDepthChart,
  StatusPieChart,
} from '../components/metrics/index';
import { Select, SelectItem } from '../components/ui/select';
import { metricsApi } from '../lib/api';

export function MetricsPage(): JSX.Element {
  const [timeRange, setTimeRange] = useState('24');

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
          <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
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
