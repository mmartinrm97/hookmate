export interface EndpointMetricsDto {
  endpointId: string;
  delivered: number;
  failed: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  period: string;
}
