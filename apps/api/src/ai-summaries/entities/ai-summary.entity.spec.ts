import { describe, expect, it } from 'vitest';
import { AiSummary } from './ai-summary.entity';

describe('AiSummary', () => {
  describe('toPrimitive', () => {
    it('converts to HookMateAiSummary shape with ISO date strings', () => {
      const summary = new AiSummary();
      summary.id = 1;
      (summary as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      summary.periodStart = new Date('2024-01-01T00:00:00.000Z');
      summary.periodEnd = new Date('2024-01-02T00:00:00.000Z');
      summary.summaryText = 'Processed 150 events with 3 failures.';
      summary.eventCount = 150;
      summary.failureCount = 3;
      summary.topCategories = { user: 80, billing: 50, system: 20 };
      summary.model = 'gpt-4o-mini';
      summary.generatedAt = new Date('2024-01-02T01:00:00.000Z');

      const primitive = summary.toPrimitive();

      expect(primitive).toEqual({
        id: 1,
        endpointId: '01ARYZ3NDEKTSV4RRFFQ69G5FAW',
        periodStart: '2024-01-01T00:00:00.000Z',
        periodEnd: '2024-01-02T00:00:00.000Z',
        summaryText: 'Processed 150 events with 3 failures.',
        eventCount: 150,
        failureCount: 3,
        topCategories: { user: 80, billing: 50, system: 20 },
        model: 'gpt-4o-mini',
        generatedAt: '2024-01-02T01:00:00.000Z',
      });
    });

    it('handles null optional fields', () => {
      const summary = new AiSummary();
      summary.id = 2;
      (summary as unknown as Record<string, unknown>).endpointId = '01ARYZ3NDEKTSV4RRFFQ69G5FAW';
      summary.periodStart = new Date('2024-01-01T00:00:00.000Z');
      summary.periodEnd = new Date('2024-01-02T00:00:00.000Z');
      summary.summaryText = 'No significant activity.';
      summary.eventCount = null;
      summary.failureCount = null;
      summary.topCategories = null;
      summary.model = null;
      summary.generatedAt = new Date('2024-01-02T01:00:00.000Z');

      const primitive = summary.toPrimitive();

      expect(primitive.eventCount).toBeNull();
      expect(primitive.failureCount).toBeNull();
      expect(primitive.topCategories).toBeNull();
      expect(primitive.model).toBeNull();
    });
  });
});
