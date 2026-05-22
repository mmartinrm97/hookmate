import type { HookMateEvent, HookMateEventStatus } from '@hookmate/shared';
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

@Entity('events')
@Index(['endpointId', 'receivedAt'])
@Index(['status'])
@Index(['category'])
export class Event {
  @PrimaryColumn('varchar', { length: 26 })
  id!: string;

  @ManyToOne(() => Endpoint)
  @JoinColumn({ name: 'endpoint_id' })
  endpointId!: Endpoint;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  headers!: Record<string, string> | null;

  @Column('varchar', { length: 45, nullable: true })
  sourceIp!: string | null;

  @Column('varchar', { length: 20, default: 'received' })
  status!: HookMateEventStatus;

  @Column('varchar', { length: 100, nullable: true })
  category!: string | null;

  @Column('varchar', { length: 64, nullable: true })
  traceId!: string | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt!: Date;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  toPrimitive(): HookMateEvent {
    return {
      id: this.id,
      endpointId: this.resolveRelationId(this.endpointId),
      payload: this.payload,
      headers: this.headers,
      sourceIp: this.sourceIp,
      status: this.status,
      category: this.category,
      traceId: this.traceId,
      receivedAt: this.receivedAt.toISOString(),
      deliveredAt: this.deliveredAt?.toISOString() ?? null,
    };
  }

  private resolveRelationId(relation: unknown): string {
    if (typeof relation === 'object' && relation !== null) {
      return (relation as { id: string }).id;
    }
    return (relation as string) ?? '';
  }
}
