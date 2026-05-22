import type { HookMateAiSummary } from '@hookmate/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Endpoint } from '../../endpoints/entities/endpoint.entity';

@Entity('ai_summaries')
@Unique(['endpointId', 'periodStart'])
export class AiSummary {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @ManyToOne(() => Endpoint)
  @JoinColumn({ name: 'endpoint_id' })
  endpointId!: Endpoint;

  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  @Column({ type: 'timestamptz' })
  periodEnd!: Date;

  @Column('text')
  summaryText!: string;

  @Column('int', { nullable: true })
  eventCount!: number | null;

  @Column('int', { nullable: true })
  failureCount!: number | null;

  @Column('jsonb', { nullable: true })
  topCategories!: Record<string, number> | null;

  @Column('varchar', { length: 50, nullable: true })
  model!: string | null;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt!: Date;

  toPrimitive(): HookMateAiSummary {
    return {
      id: this.id,
      endpointId: this.resolveRelationId(this.endpointId),
      periodStart: this.periodStart.toISOString(),
      periodEnd: this.periodEnd.toISOString(),
      summaryText: this.summaryText,
      eventCount: this.eventCount,
      failureCount: this.failureCount,
      topCategories: this.topCategories,
      model: this.model,
      generatedAt: this.generatedAt.toISOString(),
    };
  }

  private resolveRelationId(relation: unknown): string {
    if (typeof relation === 'object' && relation !== null) {
      return (relation as { id: string }).id;
    }
    return (relation as string) ?? '';
  }
}
