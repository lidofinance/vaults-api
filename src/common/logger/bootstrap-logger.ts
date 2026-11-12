import { commonPatterns, satanizer } from '@lidofinance/satanizer';
import { SECRET_ENV_KEYS, SECRET_URLS_KEYS } from 'common/config/env.secrets';
import { getProviderUrlSecrets } from 'common/config/url-secrets';

// Environment validation and migrations run before the Nest logger exists.
let mask: (<T>(input: T) => T) | null = null;

const getMask = () => {
  if (mask) return mask;

  const directSecrets = SECRET_ENV_KEYS.map((key) => process.env[key]).filter((value): value is string => !!value);
  const providerSecrets = SECRET_URLS_KEYS.flatMap((key) => getProviderUrlSecrets(process.env[key]));

  mask = satanizer([...commonPatterns, ...directSecrets, ...providerSecrets]);
  return mask;
};

export const logBootstrapError = (message: string, context: string): void => {
  process.stderr.write(`${JSON.stringify({ level: 'error', context, message: getMask()(message) })}\n`);
};
