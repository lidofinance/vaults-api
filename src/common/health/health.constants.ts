// /health is retained for the existing infrastructure and Docker HEALTHCHECK;
// /readyz is the k8s readiness probe (memory + PostgreSQL) and /livez the liveness probe.
export const HEALTH_URL = 'health';
export const LIVE_URL = 'livez';
export const READYZ_URL = 'readyz';

export const MAX_MEMORY_HEAP = 1024 * 1024 * 1024; // 1 GB
