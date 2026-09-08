import * as fs from 'node:fs';
import * as path from 'node:path';

interface BuildInfo {
  version?: string;
  branch?: string;
  commit?: string;
}

function loadJson<T>(fileName: string): T {
  try {
    const filePath = path.join(process.cwd(), fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {} as T;
  }
}

const buildInfo = loadJson<BuildInfo>('build-info.json');
const packageInfo = loadJson<{ name?: string; version?: string; description?: string }>('package.json');

/** The committed build-info.json ships placeholders that the image build fills in. */
const isPlaceholder = (value?: string): value is undefined => !value || value.startsWith('REPLACE_WITH_');

// The committed placeholders are truthy strings, so `??` alone would let
// "REPLACE_WITH_VERSION" through into the Sentry release, the Swagger document
// version and the build_info labels whenever the image build did not
// substitute the file (any local run, or a broken build step).
export const APP_VERSION = isPlaceholder(buildInfo.version) ? packageInfo.version ?? 'unversioned' : buildInfo.version;
export const APP_BRANCH = isPlaceholder(buildInfo.branch) ? 'unknown' : buildInfo.branch;
export const APP_COMMIT = isPlaceholder(buildInfo.commit) ? 'unknown' : buildInfo.commit;

/**
 * Feeds METRICS_PREFIX, so it must not depend on how the process is started.
 * `npm_package_*` is only set when running through yarn/npm; the image runs
 * `node dist/main` from a stage that has no yarn at all, which silently turned
 * the metric prefix into `unnamed_` and blanked every Grafana panel querying
 * `crap_api_*`. The packaged package.json is copied into the image, so it is
 * the reliable source.
 */
export const APP_NAME = process.env.npm_package_name ?? packageInfo.name ?? 'unnamed';
export const APP_DESCRIPTION = process.env.npm_package_description ?? packageInfo.description;
