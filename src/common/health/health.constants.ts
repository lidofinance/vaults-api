// TODO:
//  During the migration from the old infrastructure to k8s,
//  we'll keep the existing /health endpoint for compatibility.
//  In the future, it will most likely be renamed to /readyz to better reflect its semantics.
export const HEALTH_URL = 'health';
export const LIVE_URL = 'livez';
