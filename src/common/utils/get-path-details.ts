import { HTTP_PATHS } from '../../http/http.constants';

export const getPathDetails = (originalUrl: string) => {
  try {
    const path = originalUrl.split('?')[0];
    const parts = path.split('/');
    const version = parseInt(parts[1]?.substring(1));
    const rest = parts.slice(2);
    const routeWithoutVersion = rest.join('/');

    // check version and path
    const httpPathMap = HTTP_PATHS[version as keyof typeof HTTP_PATHS] as Record<string, string> | undefined;
    if (!version || !httpPathMap) return { version: 'unknown', route: 'unknown' as const };

    // fast track if 'routeWithoutVersion' has exact match (no {args} in HTTP_PATHS)
    if (routeWithoutVersion in httpPathMap) return { version, route: routeWithoutVersion };

    // find match with {args} in HTTP_PATHS
    const match = Object.keys(httpPathMap).find((pathItem) => {
      const templateSegments = pathItem.split('/');
      return (
        templateSegments.length === rest.length &&
        templateSegments.every((seg, i) => (seg.startsWith('{') && seg.endsWith('}') ? !!rest[i] : seg === rest[i]))
      );
    });
    if (match) return { version, route: match };

    return { version, route: 'unknown' as const };
  } catch {
    return { version: 'unknown', route: 'unknown' as const };
  }
};
