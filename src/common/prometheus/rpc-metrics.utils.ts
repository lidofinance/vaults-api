const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalizes a provider host per the RPC metrics policy: strip protocol, lowercase,
 * collapse to the registrable domain (`lb.drpc.org` -> `drpc.org`), keep IPs (with port) as-is.
 * Keeps label cardinality low across provider subdomains that route to the same vendor.
 */
export const normalizeRpcProvider = (urlOrHost: string | undefined): string => {
  if (!urlOrHost) return 'unknown';

  const withoutProtocol = urlOrHost.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = withoutProtocol.split('/')[0];
  const [host, port] = hostPort.split(':');

  if (IPV4_HOST.test(host)) {
    return port ? `${host}:${port}` : host;
  }

  const labels = host.toLowerCase().split('.');
  return labels.length > 2 ? labels.slice(-2).join('.') : labels.join('.');
};

/**
 * Extracts a JSON-RPC error code (e.g. -32603) for the `rpc_error_code` label.
 * Ethers also uses `.code` for its own string error categories (SERVER_ERROR,
 * REQUEST_TIMEOUT, ...) — those aren't RPC error codes, so they're left blank.
 */
export const extractRpcErrorCode = (error: unknown): string => {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'number') return String(code);
  if (typeof code === 'string' && /^-?\d+$/.test(code)) return code;
  return '';
};

/**
 * Maps an HTTP status code to its class for the `response_code` label (`2xx`, `4xx`, ...).
 * A missing status (network error) is left blank.
 */
export const toResponseCodeClass = (status?: number): string => {
  if (!status) return '';
  return `${Math.floor(status / 100)}xx`;
};
