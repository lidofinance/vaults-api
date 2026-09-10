import { Counter, Histogram, Registry } from 'prom-client';
import { LoggerService } from '@lido-nestjs/logger';

import { CustomLogger } from './custom.logger';

// ---------------------------------------------------------------------------
// CustomLogger
//
// TypeORM error strings can carry query fragments and connection details, so they
// must go through the injected logger (which masks secrets and emits JSON) and
// never through `console`.
// ---------------------------------------------------------------------------

describe('CustomLogger', () => {
  let logger: { error: jest.Mock; warn: jest.Mock; log: jest.Mock };
  let counter: Counter<'operation' | 'detail' | 'status'>;
  let duration: Histogram<'operation' | 'detail'>;
  let dbLogger: CustomLogger;
  let consoleSpies: jest.SpyInstance[];

  beforeEach(() => {
    const registry = new Registry();
    logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    duration = new Histogram({
      name: 'test_db_query_duration',
      help: 'test',
      labelNames: ['operation', 'detail'],
      registers: [registry],
    });
    counter = new Counter({
      name: 'test_db_query_count',
      help: 'test',
      labelNames: ['operation', 'detail', 'status'],
      registers: [registry],
    });
    dbLogger = new CustomLogger(duration, counter, logger as unknown as LoggerService);

    consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('reports query errors through the injected logger, not console', () => {
    dbLogger.logQueryError(new Error('boom'), '/* vaults.findAll */ SELECT * FROM "vaults" WHERE id = $1');

    expect(logger.error).toHaveBeenCalledTimes(1);
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('includes the parsed operation and detail in the logged message', () => {
    dbLogger.logQueryError('connection terminated', '/* vaults.findAll */ SELECT * FROM "vaults"');

    const message = logger.error.mock.calls[0][0] as string;
    expect(message).toContain('operation=select');
    expect(message).toContain('detail=vaults.findAll');
    expect(message).toContain('connection terminated');
  });

  it('falls back to the table name when the query has no tag', () => {
    dbLogger.logQueryError('boom', 'INSERT INTO "vault_states" ("id") VALUES ($1)');

    const message = logger.error.mock.calls[0][0] as string;
    expect(message).toContain('operation=insert');
    expect(message).toContain('detail=vault_states');
  });

  it('counts failed queries as errors', () => {
    const inc = jest.spyOn(counter, 'inc');

    dbLogger.logQueryError('boom', 'SELECT 1');

    expect(inc).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });

  it('does not log successful slow queries, only measures them', () => {
    const observe = jest.spyOn(duration, 'observe');

    dbLogger.logQuerySlow(12, '/* vaults.findAll */ SELECT * FROM "vaults"');

    expect(observe).toHaveBeenCalledWith({ operation: 'select', detail: 'vaults.findAll' }, 12);
    expect(logger.error).not.toHaveBeenCalled();
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
