export interface SystemMetricsDto {
  totalEvents: number;
  byStatus: Record<string, number>;
  dlqDepth: number;
  errorRate: number;
}
