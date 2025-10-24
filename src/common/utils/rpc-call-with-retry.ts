import { LoggerService } from 'common/logger';

export const rpcCallWithRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    callName: string;
    attempts?: number;
    delayMs?: number;
    logger?: LoggerService;
    acceptResult?: (result: T) => boolean;
  },
): Promise<T> => {
  const { callName, attempts = 5, delayMs = 200, logger, acceptResult } = options;

  for (let i = 1; i <= attempts; i++) {
    if (i > 1) {
      logger && logger.log(`[rpcCallWithRetry:${callName}] attempt=${i}`);
    }

    try {
      const result = await fn();
      if (!acceptResult || acceptResult(result)) {
        return result;
      }
    } catch (err) {
      logger && logger.error(`[rpcCallWithRetry:${callName}] catch err=${err}`);
    }

    if (i < attempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  logger && logger.error(`[rpcCallWithRetry:${callName}] attempts exhausted`);
  throw new Error(`[rpcCallWithRetry:${callName}]: attempts exhausted`);
};
