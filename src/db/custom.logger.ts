import { Logger } from 'typeorm';
import { Counter, Histogram } from 'prom-client';

const UNKNOWN = 'unknown';

export class CustomLogger implements Logger {
  constructor(
    private readonly duration: Histogram<'operation' | 'detail'>,
    private readonly counter: Counter<'operation' | 'detail' | 'status'>,
  ) {}

  logQuery() {
    // Required by the TypeORM Logger interface — not used in this implementation
  }

  logQueryError(error: string | Error, query: string) {
    const operation = CustomLogger.getOperation(query) ?? UNKNOWN;
    const detail = CustomLogger.getQueryTag(query) ?? CustomLogger.getEntity(query) ?? UNKNOWN;
    console.log(`[DBCustomLogger.logQueryError] operation=${operation}, detail=${detail}, error=${error}`);
    this.counter.inc({ operation, detail, status: 'error' });
  }

  logQuerySlow(time: number, query: string) {
    const operation = CustomLogger.getOperation(query) ?? UNKNOWN;
    const detail = CustomLogger.getQueryTag(query) ?? CustomLogger.getEntity(query) ?? UNKNOWN;
    this.duration.observe({ operation, detail }, time); // time is ms
    this.counter.inc({ operation, detail, status: 'success' });
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

  private static getOperation(query: string): string {
    // remove comments in the begging
    const stripped = query
      .replace(/^\/\*[\s\S]*?\*\//, '')
      .trim()
      .toLowerCase();

    switch (true) {
      case stripped.startsWith('start transaction'):
        return 'start_transaction';
      case stripped.startsWith('begin'):
        return 'begin';
      case stripped.startsWith('commit'):
        return 'commit';
      case stripped.startsWith('rollback'):
        return 'rollback';
      case stripped.startsWith('with'):
        return 'with';
      case stripped.startsWith('select'):
        return 'select';
      case stripped.startsWith('insert'):
        return 'insert';
      case stripped.startsWith('update'):
        return 'update';
      case stripped.startsWith('delete'):
        return 'delete';
      default:
        // fallback: just first token
        return stripped.split(/\s+/)[0];
    }
  }

  private static getQueryTag(query: string): string {
    const match = query.match(/\/\*\s*([\w.$-]+)\s*\*\//);
    return match?.[1];
  }

  private static getEntity(query: string): string {
    // Find 'select ... from'
    const fromMatches = [...query.matchAll(/\bfrom\s+("?\w+"?)/gi)];
    for (const match of fromMatches) {
      const table = match[1]?.replace(/"/g, '');

      if (table && !['select', '(', 'values'].includes(table.toLowerCase())) {
        return table;
      }
    }

    // Find 'insert'
    const insertMatch = query.match(/\binto\s+("?\w+"?)/i);
    if (insertMatch?.[1]) {
      return insertMatch[1].replace(/"/g, '');
    }

    // Find 'update'
    const updateMatch = query.match(/\bupdate\s+("?\w+"?)/i);
    if (updateMatch?.[1]) {
      return updateMatch[1].replace(/"/g, '');
    }

    // Find 'delete'
    const deleteMatch = query.match(/\bdelete\s+from\s+("?\w+"?)/i);
    if (deleteMatch?.[1]) {
      return deleteMatch[1].replace(/"/g, '');
    }
  }
}
