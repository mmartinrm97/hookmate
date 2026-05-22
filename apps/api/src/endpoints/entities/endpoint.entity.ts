import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { HookMateEndpoint, HookMateEndpointStatus } from '@hookmate/shared';
import { ulid } from 'ulid';

@Entity('endpoints')
export class Endpoint {
  @PrimaryColumn('varchar', { length: 26 })
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { name: 'destination_url', nullable: true })
  destinationUrl!: string;

  @Column('varchar', { length: 255, nullable: true })
  secret?: string | null;

  @Column('varchar', { length: 20, default: 'active' })
  status!: HookMateEndpointStatus;

  @Column('int', { name: 'max_retries', default: 5 })
  maxRetries!: number;

  @Column('int', { name: 'retry_base_delay_ms', default: 5000 })
  retryBaseDelayMs!: number;

  @Column('int', { name: 'dlq_threshold', default: 100 })
  dlqThreshold!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  toPrimitive(): HookMateEndpoint {
    return {
      id: this.id,
      name: this.name,
      destinationUrl: this.destinationUrl,
      secret: this.secret ?? undefined,
      status: this.status,
      maxRetries: this.maxRetries,
      retryBaseDelayMs: this.retryBaseDelayMs,
      dlqThreshold: this.dlqThreshold,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
