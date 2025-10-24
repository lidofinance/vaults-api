import { LoggerService } from 'common/logger';

export const callWithRetry = async <T>(
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
      logger && logger.log(`[callWithRetry:${callName}] attempt=${i}`);
    }

    try {
      const result = await fn();
      if (!acceptResult || acceptResult(result)) {
        return result;
      }
    } catch (err) {
      logger && logger.error(`[callWithRetry:${callName}] catch err=${err}`);
    }

    if (i < attempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  logger && logger.error(`[callWithRetry:${callName}] attempts exhausted`);
  throw new Error(`[callWithRetry:${callName}]: attempts exhausted`);
};
