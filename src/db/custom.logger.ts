import { Logger } from 'typeorm';
import { Counter, Histogram } from 'prom-client';

export class CustomLogger implements Logger {
  constructor(
    private readonly duration: Histogram<'operation' | 'detail'>,
    private readonly counter: Counter<'operation' | 'detail'>,
  ) {}

  logQuery(query: string) {
    const end = this.duration.startTimer({
      operation: CustomLogger.getOperation(query) ?? 'unknown',
      detail: CustomLogger.getQueryTag(query) ?? CustomLogger.getEntity(query) ?? 'unknown',
    });
    end();
  }

  logQueryError(error: string | Error, query: string) {
    console.error(`[DB.CustomLogger.Error] ${error}`);
    this.counter.inc({
      operation: `query:${CustomLogger.getOperation(query)}`,
      detail: CustomLogger.getQueryTag(query),
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

  private static getOperation(query: string): string {
    // remove comments in the begging
    const stripped = query
      .replace(/^\/\*[\s\S]*?\*\//, '')
      .trim()
      .toLowerCase();

    if (stripped.startsWith('start transaction')) return 'start_transaction';
    if (stripped.startsWith('begin')) return 'begin';
    if (stripped.startsWith('commit')) return 'commit';
    if (stripped.startsWith('rollback')) return 'rollback';
    if (stripped.startsWith('with')) return 'with'; // CTE-запрос
    if (stripped.startsWith('select')) return 'select';
    if (stripped.startsWith('insert')) return 'insert';
    if (stripped.startsWith('update')) return 'update';
    if (stripped.startsWith('delete')) return 'delete';

    // fallback: just first token
    return stripped.split(/\s+/)[0];
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
