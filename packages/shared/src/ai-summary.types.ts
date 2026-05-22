export interface HookMateAiSummary {
  id: number;
  endpointId: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  eventCount: number | null;
  failureCount: number | null;
  topCategories: Record<string, number> | null;
  model: string | null;
  generatedAt: string;
}
