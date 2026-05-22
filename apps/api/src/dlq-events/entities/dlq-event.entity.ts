import type { HookMateDlqEvent } from '@hookmate/shared';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ulid } from 'ulid';
import { Endpoint } from '../../endpoints/entities/endpoint.entity';
import { Event } from '../../events/entities/event.entity';

@Entity('dlq_events')
@Index(['endpointId', 'createdAt'])
export class DlqEvent {
  @PrimaryColumn('varchar', { length: 26 })
  id!: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  eventId!: Event;

  @ManyToOne(() => Endpoint)
  @JoinColumn({ name: 'endpoint_id' })
  endpointId!: Endpoint;

  @Column('text', { nullable: true })
  failureReason!: string | null;

  @Column('jsonb')
  attemptsJson!: unknown[];

  @Column('jsonb')
  endpointSnapshot!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'retried_at', nullable: true })
  retriedAt!: Date | null;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  toPrimitive(): HookMateDlqEvent {
    return {
      id: this.id,
      eventId: this.resolveRelationId(this.eventId),
      endpointId: this.resolveRelationId(this.endpointId),
      failureReason: this.failureReason,
      attemptsJson: this.attemptsJson,
      endpointSnapshot: this.endpointSnapshot,
      createdAt: this.createdAt.toISOString(),
      retriedAt: this.retriedAt?.toISOString() ?? null,
    };
  }

  private resolveRelationId(relation: unknown): string {
    if (typeof relation === 'object' && relation !== null) {
      return (relation as { id: string }).id;
    }
    return (relation as string) ?? '';
  }
}
