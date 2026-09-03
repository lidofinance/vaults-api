import { getCacheControlHeaders } from '../cache/cache.utils';

export const SWAGGER_URL = 'api';
export const SWAGGER_CACHE_MAX_AGE = 120;
export const SWAGGER_CACHE_CONTROL = getCacheControlHeaders({ maxAge: SWAGGER_CACHE_MAX_AGE });
