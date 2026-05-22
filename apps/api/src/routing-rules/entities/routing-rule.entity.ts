import type {
  HookMateDestinationType,
  HookMateMatchType,
  HookMateRoutingRule,
} from '@hookmate/shared';
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

@Entity('routing_rules')
@Unique(['endpointId', 'priority'])
export class RoutingRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @ManyToOne(() => Endpoint)
  @JoinColumn({ name: 'endpoint_id' })
  endpointId!: Endpoint;

  @Column('int', { default: 0 })
  priority!: number;

  @Column('varchar', { length: 20 })
  matchType!: HookMateMatchType;

  @Column('varchar', { length: 255, nullable: true })
  matchKey!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  matchValue!: string | null;

  @Column('varchar', { length: 20, nullable: true })
  destinationType!: HookMateDestinationType | null;

  @Column('text', { nullable: true })
  destinationUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  toPrimitive(): HookMateRoutingRule {
    return {
      id: this.id,
      endpointId: this.resolveRelationId(this.endpointId),
      priority: this.priority,
      matchType: this.matchType,
      matchKey: this.matchKey,
      matchValue: this.matchValue,
      destinationType: this.destinationType,
      destinationUrl: this.destinationUrl,
      createdAt: this.createdAt.toISOString(),
    };
  }

  private resolveRelationId(relation: unknown): string {
    if (typeof relation === 'object' && relation !== null) {
      return (relation as { id: string }).id;
    }
    return (relation as string) ?? '';
  }
}
