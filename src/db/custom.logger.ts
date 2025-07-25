import { Logger } from 'typeorm';
import { Counter, Histogram } from 'prom-client';

export class CustomLogger implements Logger {
  constructor(
    private readonly duration: Histogram<'operation' | 'entity'>,
    private readonly counter: Counter<'operation' | 'entity'>,
  ) {}

  logQuery(query: string) {
    const operation = query.split(' ')[0].toLowerCase();
    const end = this.duration.startTimer({ operation, entity: this.getEntity(query) });
    end();
  }

  logQueryError(error: string | Error, query: string) {
    const operation = this.getOperation(query);
    const entity = this.getEntity(query);

    console.error(`[DB.CustomLogger.Error] ${error}`);

    this.counter.inc({
      operation: `query:${operation}`,
      entity: entity,
    });
  }

  logQuerySlow() {
    // Required by the TypeORM Logger interface — not used in this implementation
  }
  logSchemaBuild() {
    // Required by the TypeORM Logger interface — not used in this implementation
  }
  logMigration() {
    // Required by the TypeORM Logger interface — not used in this implementation
  }
  log() {
    // Required by the TypeORM Logger interface — not used in this implementation
  }

  private getOperation(query: string): string {
    return query.trim().split(' ')[0].toLowerCase() || 'unknown';
  }

  private getEntity(query: string): string {
    const match = query.match(/from\s+("?[\w\d_]+"?)/i);
    return match?.[1]?.replace(/"/g, '') ?? 'unknown';
  }
}
