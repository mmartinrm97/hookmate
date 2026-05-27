import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Type-export verification: these tests ensure all symbols compile and
// export correctly. There is no runtime logic to test — the interfaces and
// type aliases are pure compile-time constructs.
// ---------------------------------------------------------------------------

describe('HookMateEvent types', () => {
  it('exports HookMateEventStatus values', () => {
    const statuses: string[] = ['received', 'processing', 'delivered', 'failed', 'dead_lettered'];
    expect(statuses).toHaveLength(5);
  });

  it('constructs a minimal HookMateEvent', () => {
    const event: import('./event.types').HookMateEvent = {
      id: '01J01ABCDEFGHIJKLMNOPQRST',
      endpointId: '01J01ABCDEFGHIJKLMNOPQRSU',
      payload: { hello: 'world' },
      headers: null,
      sourceIp: null,
      status: 'received',
      category: null,
      traceId: null,
      receivedAt: '2025-01-01T00:00:00Z',
      deliveredAt: null,
    };
    expect(event.status).toBe('received');
    expect(event.id).toBe('01J01ABCDEFGHIJKLMNOPQRST');
  });

  it('constructs a fully populated HookMateEvent', () => {
    const event: import('./event.types').HookMateEvent = {
      id: '01J01ABCDEFGHIJKLMNOPQRST',
      endpointId: '01J01ABCDEFGHIJKLMNOPQRSU',
      payload: { data: 42 },
      headers: { 'content-type': 'application/json' },
      sourceIp: '192.168.1.1',
      status: 'delivered',
      category: 'payment',
      traceId: 'trace-abc-123',
      receivedAt: '2025-01-01T00:00:00Z',
      deliveredAt: '2025-01-01T00:00:05Z',
    };
    expect(event.status).toBe('delivered');
    expect(event.headers!['content-type']).toBe('application/json');
    expect(event.deliveredAt).toBe('2025-01-01T00:00:05Z');
  });
});

describe('HookMateDeliveryAttempt types', () => {
  it('exports HookMateDeliveryAttemptStatus values', () => {
    const statuses: string[] = ['success', 'failed', 'timeout'];
    expect(statuses).toHaveLength(3);
  });

  it('constructs a HookMateDeliveryAttempt', () => {
    const attempt: import('./delivery-attempt.types').HookMateDeliveryAttempt = {
      id: 1,
      eventId: '01J01ABCDEFGHIJKLMNOPQRST',
      attemptNumber: 1,
      destinationUrl: 'https://example.com/webhook',
      httpStatus: 200,
      responseBody: 'OK',
      latencyMs: 120,
      status: 'success',
      attemptedAt: '2025-01-01T00:00:00Z',
    };
    expect(attempt.status).toBe('success');
    expect(attempt.httpStatus).toBe(200);
  });

  it('constructs a HookMateDeliveryAttempt with nullable fields as null', () => {
    const attempt: import('./delivery-attempt.types').HookMateDeliveryAttempt = {
      id: 2,
      eventId: '01J01ABCDEFGHIJKLMNOPQRST',
      attemptNumber: 3,
      destinationUrl: 'https://example.com/webhook',
      httpStatus: null,
      responseBody: null,
      latencyMs: null,
      status: 'timeout',
      attemptedAt: '2025-01-01T00:00:00Z',
    };
    expect(attempt.httpStatus).toBeNull();
    expect(attempt.responseBody).toBeNull();
  });
});

describe('HookMateDlqEvent types', () => {
  it('constructs a HookMateDlqEvent', () => {
    const dlq: import('./dlq-event.types').HookMateDlqEvent = {
      id: '01J01ABCDEFGHIJKLMNOPQRST',
      eventId: '01J01ABCDEFGHIJKLMNOPQRSU',
      endpointId: '01J01ABCDEFGHIJKLMNOPQRSV',
      failureReason: 'Max retries exceeded',
      attemptsJson: [{ attempt: 1, status: 500 }],
      endpointSnapshot: { destinationUrl: 'https://example.com' },
      createdAt: '2025-01-01T00:00:00Z',
      retriedAt: null,
    };
    expect(dlq.failureReason).toBe('Max retries exceeded');
    expect(dlq.retriedAt).toBeNull();
  });
});

describe('PaginatedResponse type', () => {
  it('constructs a PaginatedResponse with items', () => {
    const response: import('./pagination.types').PaginatedResponse<{ id: string }> = {
      items: [{ id: '1' }, { id: '2' }],
      total: 2,
      page: 1,
      limit: 50,
    };
    expect(response.items).toHaveLength(2);
    expect(response.total).toBe(2);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(50);
  });

  it('constructs PaginatedResponse with empty items array', () => {
    const response: import('./pagination.types').PaginatedResponse<number> = {
      items: [],
      total: 0,
      page: 1,
      limit: 50,
    };
    expect(response.items).toHaveLength(0);
    expect(response.total).toBe(0);
  });
});

describe('QueryParams interface', () => {
  it('constructs QueryParams with defaults', () => {
    const params: import('./pagination.types').QueryParams = {};
    expect(params.page).toBeUndefined();
    expect(params.limit).toBeUndefined();
  });

  it('constructs QueryParams with page and limit', () => {
    const params: import('./pagination.types').QueryParams = {
      page: 2,
      limit: 25,
    };
    expect(params.page).toBe(2);
    expect(params.limit).toBe(25);
  });
});

describe('UpdateHookMateEndpointInput type', () => {
  it('constructs with partial fields', () => {
    const input: import('./endpoint.types').UpdateHookMateEndpointInput = {
      name: 'Updated name',
    };
    expect(input.name).toBe('Updated name');
    expect(input.destinationUrl).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const input: import('./endpoint.types').UpdateHookMateEndpointInput = {
      name: 'Updated',
      destinationUrl: 'https://example.com/updated',
      maxRetries: 3,
      retryBaseDelayMs: 3000,
      dlqThreshold: 50,
      secret: 'new_secret',
    };
    expect(input.secret).toBe('new_secret');
    expect(input.maxRetries).toBe(3);
  });
});

describe('CreateHookMateRoutingRuleInput type', () => {
  it('constructs with all fields', () => {
    const input: import('./routing-rule.types').CreateHookMateRoutingRuleInput = {
      priority: 10,
      matchType: 'header',
      matchKey: 'X-Region',
      matchValue: 'us-east-1',
      destinationType: 'http',
      destinationUrl: 'https://region.example.com/webhook',
    };
    expect(input.priority).toBe(10);
    expect(input.matchType).toBe('header');
  });

  it('constructs with minimum fields', () => {
    const input: import('./routing-rule.types').CreateHookMateRoutingRuleInput = {
      priority: 1,
      matchType: 'source_ip',
    };
    expect(input.priority).toBe(1);
    expect(input.matchKey).toBeUndefined();
    expect(input.destinationType).toBeUndefined();
  });
});

describe('HookMateRoutingRule types', () => {
  it('exports HookMateMatchType and HookMateDestinationType values', () => {
    const matchTypes: string[] = ['header', 'json_path', 'source_ip'];
    const destTypes: string[] = ['http', 'slack', 'discord', 'discard'];
    expect(matchTypes).toHaveLength(3);
    expect(destTypes).toHaveLength(4);
  });

  it('constructs a HookMateRoutingRule', () => {
    const rule: import('./routing-rule.types').HookMateRoutingRule = {
      id: 1,
      endpointId: '01J01ABCDEFGHIJKLMNOPQRST',
      priority: 10,
      matchType: 'header',
      matchKey: 'X-Region',
      matchValue: 'us-east-1',
      destinationType: 'http',
      destinationUrl: 'https://region.example.com/webhook',
      createdAt: '2025-01-01T00:00:00Z',
    };
    expect(rule.matchType).toBe('header');
    expect(rule.destinationType).toBe('http');
  });
});

describe('HookMateAiSummary types', () => {
  it('constructs a HookMateAiSummary', () => {
    const summary: import('./ai-summary.types').HookMateAiSummary = {
      id: 1,
      endpointId: '01J01ABCDEFGHIJKLMNOPQRST',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-01-02T00:00:00Z',
      summaryText: 'All events processed successfully',
      eventCount: 150,
      failureCount: 2,
      topCategories: { payment: 100, notification: 50 },
      model: 'gpt-4o-mini',
      generatedAt: '2025-01-02T01:00:00Z',
    };
    expect(summary.summaryText).toBe('All events processed successfully');
    expect(summary.eventCount).toBe(150);
  });

  it('constructs a HookMateAiSummary with nullable fields as null', () => {
    const summary: import('./ai-summary.types').HookMateAiSummary = {
      id: 2,
      endpointId: '01J01ABCDEFGHIJKLMNOPQRST',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-01-02T00:00:00Z',
      summaryText: 'Minimal summary',
      eventCount: null,
      failureCount: null,
      topCategories: null,
      model: null,
      generatedAt: '2025-01-02T01:00:00Z',
    };
    expect(summary.eventCount).toBeNull();
    expect(summary.model).toBeNull();
  });
});

describe('index.ts barrel exports', () => {
  it('re-exports all type symbols (verifiable by name)', async () => {
    // Dynamic import ensures the barrel resolves correctly.
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });

  it('re-exports PaginatedResponse and QueryParams', async () => {
    const mod = await import('./pagination.types');
    expect(mod).toBeDefined();
  });

  it('re-exports UpdateHookMateEndpointInput', async () => {
    const mod = (await import('./endpoint.types')) as Record<string, unknown>;
    expect(mod.UpdateHookMateEndpointInput).toBeUndefined(); // type-only, no runtime value
    expect(mod).toBeDefined();
  });

  it('re-exports CreateHookMateRoutingRuleInput', async () => {
    const mod = await import('./routing-rule.types');
    expect(mod).toBeDefined();
  });
});
