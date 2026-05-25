import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryAttempt } from '../delivery-attempts/entities/delivery-attempt.entity';
import { DlqEvent } from '../dlq-events/entities/dlq-event.entity';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Event } from '../events/entities/event.entity';
import type { EndpointMetricsDto } from './dto/endpoint-metrics.dto';
import type { SystemMetricsDto } from './dto/system-metrics.dto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface StatusRow {
  status: string;
  count: string;
}

interface MetricsRawResult {
  delivered: string;
  failed: string;
  p50: string | null;
  p95: string | null;
  p99: string | null;
}

@Injectable()
export class MetricsService {
  private readonly endpointCache = new Map<string, CacheEntry<EndpointMetricsDto>>();

  private static readonly ENDPOINT_CACHE_TTL_MS = 30_000;
  private static readonly SYSTEM_CACHE_TTL_MS = 60_000;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(DlqEvent)
    private readonly dlqRepo: Repository<DlqEvent>,
    @InjectRepository(DeliveryAttempt)
    private readonly deliveryAttemptRepo: Repository<DeliveryAttempt>,
    private readonly endpointsService: EndpointsService,
  ) {}

  async systemMetrics(): Promise<SystemMetricsDto> {
    const rows = (await this.eventRepo
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.status')
      .getRawMany()) as StatusRow[];

    const byStatus: Record<string, number> = {};

    for (const row of rows) {
      byStatus[row.status] = Number(row.count);
    }

    const totalEvents = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    const dlqDepth = await this.dlqRepo.count();
    const failedCount = (byStatus['failed'] ?? 0) + (byStatus['dead_lettered'] ?? 0);
    const errorRate = totalEvents > 0 ? failedCount / totalEvents : 0;

    return {
      totalEvents,
      byStatus,
      dlqDepth,
      errorRate,
    };
  }

  async endpointMetrics(id: string): Promise<EndpointMetricsDto> {
    // Check cache first
    const cached = this.endpointCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    // Verify endpoint exists
    await this.endpointsService.getById(id);

    const raw = (await this.deliveryAttemptRepo
      .createQueryBuilder('da')
      .select("COUNT(*) FILTER (WHERE da.status = 'success')", 'delivered')
      .addSelect("COUNT(*) FILTER (WHERE da.status IN ('failed','timeout'))", 'failed')
      .addSelect('PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY da.latencyMs)', 'p50')
      .addSelect('PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY da.latencyMs)', 'p95')
      .addSelect('PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY da.latencyMs)', 'p99')
      .innerJoin('da.eventId', 'event')
      .where('event.endpointId = :endpointId', { endpointId: id })
      .andWhere("da.attemptedAt >= NOW() - INTERVAL '24 hours'")
      .getRawOne()) as MetricsRawResult | null;

    const result: EndpointMetricsDto = {
      endpointId: id,
      delivered: raw ? Number(raw.delivered) : 0,
      failed: raw ? Number(raw.failed) : 0,
      p50: raw?.p50 != null ? Number(raw.p50) : null,
      p95: raw?.p95 != null ? Number(raw.p95) : null,
      p99: raw?.p99 != null ? Number(raw.p99) : null,
      period: '24h',
    };

    // Cache for 30s
    this.endpointCache.set(id, {
      value: result,
      expiresAt: Date.now() + MetricsService.ENDPOINT_CACHE_TTL_MS,
    });

    return result;
  }
}
