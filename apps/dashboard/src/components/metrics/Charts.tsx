import { type JSX } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimeSeriesPoint } from '../../types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface QueueDepthChartProps {
  data: TimeSeriesPoint[] | undefined;
  isLoading: boolean;
}

export function QueueDepthChart({ data, isLoading }: QueueDepthChartProps): JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Queue Depth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <ChartEmptyState title="Queue Depth Over Time" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Queue Depth Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={(v) => {
                try {
                  return new Date(v).toLocaleTimeString();
                } catch {
                  return v;
                }
              }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <RechartsTooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(v) => {
                try {
                  return new Date(String(v)).toLocaleString();
                } catch {
                  return String(v);
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface StatusPieChartProps {
  data: { status: string; count: number }[] | undefined;
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  received: 'hsl(var(--primary))',
  processing: 'hsl(48, 96%, 53%)',
  delivered: 'hsl(160, 84%, 39%)',
  failed: 'hsl(0, 84%, 60%)',
  dead_lettered: 'hsl(271, 81%, 56%)',
};

export function StatusPieChart({ data, isLoading }: StatusPieChartProps): JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Events by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <ChartEmptyState title="Events by Status" />;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Events by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          {/* Simple bar representation instead of Pie (avoids Recharts Pie import issues) */}
          <div className="flex-1 space-y-2 min-w-[200px]">
            {data.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize">{item.status.replace('_', ' ')}</span>
                  <span className="text-muted-foreground">
                    {Math.round((item.count / total) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.count / total) * 100}%`,
                      backgroundColor: STATUS_COLORS[item.status] || 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Legend with counts */}
          <div className="space-y-1 text-xs">
            {data.map((item) => (
              <div key={item.status} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[item.status] || 'hsl(var(--primary))' }}
                />
                <span className="text-muted-foreground capitalize">
                  {item.status.replace('_', ' ')}
                </span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DeliveryLatencyChartProps {
  data: { p50: number; p90: number; p99: number; timestamp: string }[] | undefined;
  isLoading: boolean;
}

export function DeliveryLatencyChart({ data, isLoading }: DeliveryLatencyChartProps): JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delivery Latency (p50 / p90 / p99)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <ChartEmptyState title="Delivery Latency" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Delivery Latency (p50 / p90 / p99)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={(v) => {
                try {
                  return new Date(v).toLocaleTimeString();
                } catch {
                  return v;
                }
              }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              tickFormatter={(v) => `${v}ms`}
            />
            <RechartsTooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(v) => {
                try {
                  return new Date(String(v)).toLocaleString();
                } catch {
                  return String(v);
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="p50"
            />
            <Line
              type="monotone"
              dataKey="p90"
              stroke="hsl(48, 96%, 53%)"
              strokeWidth={2}
              dot={false}
              name="p90"
            />
            <Line
              type="monotone"
              dataKey="p99"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              dot={false}
              name="p99"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ErrorRateChartProps {
  data: TimeSeriesPoint[] | undefined;
  isLoading: boolean;
}

export function ErrorRateChart({ data, isLoading }: ErrorRateChartProps): JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Error Rate Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <ChartEmptyState title="Error Rate Over Time" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Error Rate Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={(v) => {
                try {
                  return new Date(v).toLocaleTimeString();
                } catch {
                  return v;
                }
              }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <RechartsTooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(v) => {
                try {
                  return new Date(String(v)).toLocaleString();
                } catch {
                  return String(v);
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              dot={false}
              fill="hsl(0, 84%, 60%, 0.1)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Empty state for charts ──────────────────────────────────────

function ChartEmptyState({ title }: { title: string }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No data available yet
        </div>
      </CardContent>
    </Card>
  );
}
