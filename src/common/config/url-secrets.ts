/**
 * Extract credentials embedded in EL RPC / CL API URLs before logging.
 * This module deliberately has no dependency on ConfigService or env.validation:
 * bootstrap logging must work even when configuration validation fails.
 */
const MIN_QUERY_SECRET_LENGTH = 16;
const SENSITIVE_QUERY_NAME = /^(?:dkey|key|api[_-]?key|apikey|access[_-]?key|auth(?:orization)?|token|access[_-]?token|secret|client[_-]?secret|password)$/i;

const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Returns the secret itself and an encoded form if URLs may log it encoded. */
const variants = (value: string): string[] => {
  if (!value) return [];
  const encoded = encodeURIComponent(value);
  return encoded === value ? [value] : [value, encoded];
};

export const getUrlSecrets = (raw: string): string[] => {
  try {
    const url = new URL(raw);
    const lastPathSegment = url.pathname.split('/').filter(Boolean).pop();
    const querySecrets = [...url.searchParams.entries()]
      .filter(([name, value]) => SENSITIVE_QUERY_NAME.test(name) || value.length >= MIN_QUERY_SECRET_LENGTH)
      .flatMap(([, value]) => variants(value));

    const username = decoded(url.username);
    const password = decoded(url.password);
    const userInfo = url.username || url.password ? `${username}:${password}` : '';
    const basicAuthToken = userInfo ? Buffer.from(userInfo, 'utf8').toString('base64') : '';

    return [...new Set([
      ...variants(decoded(lastPathSegment ?? '')),
      ...querySecrets,
      ...variants(password),
      ...variants(userInfo),
      basicAuthToken,
    ].filter(Boolean))];
  } catch {
    // Preserve the previous fallback for invalid URLs: an error could still
    // include a credential at the end of a malformed provider URL.
    const lastSegment = raw.split('/').filter(Boolean).pop();
    return lastSegment ? [lastSegment] : [];
  }
};

/** Handles both validated string[] values and comma-separated raw process.env. */
export const getProviderUrlSecrets = (value: string[] | string | null | undefined): string[] => {
  const urls = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean).flatMap(getUrlSecrets))];
};
