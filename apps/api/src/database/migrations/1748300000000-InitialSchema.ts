import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema1748300000000 implements MigrationInterface {
  name = 'InitialSchema1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "endpoints" (
        "id"                  character varying(26)       NOT NULL,
        "name"                character varying(255)      NOT NULL,
        "destination_url"     text,
        "secret"              character varying(255),
        "status"              character varying(20)       NOT NULL DEFAULT 'active',
        "max_retries"         integer                     NOT NULL DEFAULT 5,
        "retry_base_delay_ms" integer                     NOT NULL DEFAULT 5000,
        "dlq_threshold"       integer                     NOT NULL DEFAULT 100,
        "created_at"          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_endpoints" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id"           character varying(26)    NOT NULL,
        "endpoint_id"  character varying(26)    NOT NULL,
        "payload"      jsonb                    NOT NULL,
        "headers"      jsonb,
        "source_ip"    character varying(45),
        "status"       character varying(20)    NOT NULL DEFAULT 'received',
        "category"     character varying(100),
        "trace_id"     character varying(64),
        "received_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "delivered_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_events_endpoint_received" ON "events" ("endpoint_id", "received_at")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_events_status" ON "events" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_events_category" ON "events" ("category")`);
    await queryRunner.query(`
      ALTER TABLE "events"
        ADD CONSTRAINT "FK_events_endpoint_id"
        FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "delivery_attempts" (
        "id"              bigserial               NOT NULL,
        "event_id"        character varying(26)   NOT NULL,
        "attempt_number"  integer                 NOT NULL,
        "destination_url" text                    NOT NULL,
        "http_status"     integer,
        "response_body"   text,
        "latency_ms"      integer,
        "status"          character varying(20),
        "attempted_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_delivery_attempts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_attempts_event_id" ON "delivery_attempts" ("event_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "delivery_attempts"
        ADD CONSTRAINT "FK_delivery_attempts_event_id"
        FOREIGN KEY ("event_id") REFERENCES "events"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "dlq_events" (
        "id"                character varying(26)    NOT NULL,
        "event_id"          character varying(26)    NOT NULL,
        "endpoint_id"       character varying(26)    NOT NULL,
        "failure_reason"    text,
        "attempts_json"     jsonb                    NOT NULL,
        "endpoint_snapshot" jsonb                    NOT NULL,
        "created_at"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "retried_at"        TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_dlq_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_dlq_events_endpoint_created" ON "dlq_events" ("endpoint_id", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "dlq_events"
        ADD CONSTRAINT "FK_dlq_events_event_id"
        FOREIGN KEY ("event_id") REFERENCES "events"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "dlq_events"
        ADD CONSTRAINT "FK_dlq_events_endpoint_id"
        FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "routing_rules" (
        "id"               bigserial               NOT NULL,
        "endpoint_id"      character varying(26)   NOT NULL,
        "priority"         integer                 NOT NULL DEFAULT 0,
        "match_type"       character varying(20)   NOT NULL,
        "match_key"        character varying(255),
        "match_value"      character varying(255),
        "destination_type" character varying(20),
        "destination_url"  text,
        "created_at"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routing_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_routing_rules_endpoint_priority" UNIQUE ("endpoint_id", "priority")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "routing_rules"
        ADD CONSTRAINT "FK_routing_rules_endpoint_id"
        FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_summaries" (
        "id"             bigserial               NOT NULL,
        "endpoint_id"    character varying(26)   NOT NULL,
        "period_start"   TIMESTAMP WITH TIME ZONE NOT NULL,
        "period_end"     TIMESTAMP WITH TIME ZONE NOT NULL,
        "summary_text"   text                    NOT NULL,
        "event_count"    integer,
        "failure_count"  integer,
        "top_categories" jsonb,
        "model"          character varying(50),
        "generated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_summaries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_summaries_endpoint_period" UNIQUE ("endpoint_id", "period_start")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_summaries"
        ADD CONSTRAINT "FK_ai_summaries_endpoint_id"
        FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_summaries" DROP CONSTRAINT "FK_ai_summaries_endpoint_id"`,
    );
    await queryRunner.query(`DROP TABLE "ai_summaries"`);

    await queryRunner.query(
      `ALTER TABLE "routing_rules" DROP CONSTRAINT "FK_routing_rules_endpoint_id"`,
    );
    await queryRunner.query(`DROP TABLE "routing_rules"`);

    await queryRunner.query(`ALTER TABLE "dlq_events" DROP CONSTRAINT "FK_dlq_events_endpoint_id"`);
    await queryRunner.query(`ALTER TABLE "dlq_events" DROP CONSTRAINT "FK_dlq_events_event_id"`);
    await queryRunner.query(`DROP TABLE "dlq_events"`);

    await queryRunner.query(
      `ALTER TABLE "delivery_attempts" DROP CONSTRAINT "FK_delivery_attempts_event_id"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_attempts"`);

    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_endpoint_id"`);
    await queryRunner.query(`DROP TABLE "events"`);

    await queryRunner.query(`DROP TABLE "endpoints"`);
  }
}
