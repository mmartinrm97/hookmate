import type { HookMateDeliveryAttempt, HookMateDeliveryAttemptStatus } from '@hookmate/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';

@Entity('delivery_attempts')
@Index(['eventId'])
export class DeliveryAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  eventId!: Event;

  @Column('int')
  attemptNumber!: number;

  @Column('text')
  destinationUrl!: string;

  @Column('int', { nullable: true })
  httpStatus!: number | null;

  @Column('text', { nullable: true })
  responseBody!: string | null;

  @Column('int', { nullable: true })
  latencyMs!: number | null;

  @Column('varchar', { length: 20, nullable: true })
  status!: HookMateDeliveryAttemptStatus | null;

  @CreateDateColumn({ name: 'attempted_at' })
  attemptedAt!: Date;

  toPrimitive(): HookMateDeliveryAttempt {
    return {
      id: this.id,
      eventId: this.resolveRelationId(this.eventId),
      attemptNumber: this.attemptNumber,
      destinationUrl: this.destinationUrl,
      httpStatus: this.httpStatus,
      responseBody: this.responseBody,
      latencyMs: this.latencyMs,
      status: this.status ?? 'failed',
      attemptedAt: this.attemptedAt.toISOString(),
    };
  }

  private resolveRelationId(relation: unknown): string {
    if (typeof relation === 'object' && relation !== null) {
      return (relation as { id: string }).id;
    }
    return (relation as string) ?? '';
  }
}
