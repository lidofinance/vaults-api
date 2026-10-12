import type { EnvironmentVariables } from './env.validation';

/**
 * Env vars whose values must never reach logs, Sentry payloads or Prometheus
 * label values. `ConfigService.secrets` builds the log/Sentry masker from this
 * list, and the startup env dump replaces these values outright — pattern-based
 * masking cannot be relied on for arbitrary key/secret shapes.
 *
 * Kept in a tiny module (imports only a type) so bootstrap scripts — e.g. the
 * migration runner — can read the key names without pulling in class-validator /
 * class-transformer via `env.validation`.
 */
export const SECRET_ENV_KEYS: (keyof EnvironmentVariables)[] = ['SENTRY_DSN', 'POSTGRES_PASSWORD'];
export const SECRET_URLS_KEYS: (keyof EnvironmentVariables)[] = ['CL_API_URLS', 'EL_RPC_URLS'];
