import { getOrCreateMetric } from '@willsoto/nestjs-prometheus';
import { Options, Metrics, Metric } from './interfaces';
import { METRICS_PREFIX } from './prometheus.constants';
import { ENV_KEYS } from '../config';

export class PrometheusService {
  protected prefix = METRICS_PREFIX;

  protected getOrCreateMetric<T extends Metrics, L extends string>(type: T, options: Options<L>): Metric<T, L> {
    const prefixedName = options.prefix ? this.prefix + options.name : options.name;

    return getOrCreateMetric(type, {
      ...options,
      name: prefixedName,
    }) as Metric<T, L>;
  }

  public httpRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'http_requests_duration_seconds',
    help: 'Duration of http requests',
    buckets: [0.01, 0.1, 0.2, 0.5, 1, 1.5, 2, 5],
    labelNames: ['statusCode', 'method', 'route', 'version'],
  });

  public buildInfo = this.getOrCreateMetric('Gauge', {
    name: 'build_info',
    help: 'Build information',
    labelNames: ['name', 'version', 'env', 'network'],
  });

  public envsInfo = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'envs_info',
    help: 'Environment variables information',
    labelNames: ENV_KEYS,
  });

  public elRpcRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'el_rpc_requests_duration_seconds',
    help: 'EL RPC request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5],
    labelNames: ['result'],
  });

  public clApiRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'cl_api_requests_duration_seconds',
    help: 'CL API request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result'],
  });

  public ipfsRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'ipfs_requests_duration_seconds',
    help: 'CL API request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result'],
  });

  public dbQueryDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'db_query_duration_seconds',
    help: 'Duration of DB queries in seconds',
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
    labelNames: ['operation', 'detail'],
  });

  public dbQueryErrorCounter = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'db_query_error_counter',
    help: 'Total number of DB query errors, labeled by event name and result',
    labelNames: ['operation', 'detail'],
  });

  public contractEventHandledCounter = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'contract_event_handled_counter',
    help: 'Total number of contract events handled, labeled by event name and result',
    labelNames: ['eventName', 'result'],
  });

  public lastUpdateGauge = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'last_update_info',
    help: 'Timestamp and block number of the last update',
    labelNames: ['source', 'type'],
  });

  public jobDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'job_duration_seconds',
    help: 'Job execution duration',
    buckets: [0.2, 0.6, 1, 2, 3, 5, 8, 13, 30, 60],
    labelNames: ['name'],
  });

  public jobCount = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'job_count',
    help: 'Count of passed or failed jobs',
    labelNames: ['name', 'status'],
  });
}
