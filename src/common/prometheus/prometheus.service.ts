import { getOrCreateMetric } from '@willsoto/nestjs-prometheus';
import { Options, Metrics, Metric } from './interfaces';
import { METRICS_PREFIX, RPC_LABEL_NAMES } from './prometheus.constants';
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
    labelNames: ['name', 'version', 'env', 'network', 'branch', 'commit'],
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

  // Standard RPC metrics policy set. Intentionally unprefixed so the service shows up
  // on the shared Lido dashboards and alerts.
  public httpRpcRequestsTotal = this.getOrCreateMetric('Counter', {
    name: 'http_rpc_requests_total',
    help: 'Total number of RPC requests made by the application',
    labelNames: [...RPC_LABEL_NAMES, 'method', 'result', 'rpc_error_code'],
  });

  public httpRpcResponseSeconds = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_response_seconds',
    help: 'Distribution of RPC response times',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcBatchSize = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_batch_size',
    help: 'Distribution of how many JSON-RPC calls are bundled in each HTTP request',
    buckets: [1, 2, 5, 10, 20, 50, 100],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcRequestPayloadBytes = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_request_payload_bytes',
    help: 'Distribution of RPC request payload sizes',
    buckets: [256, 512, 1024, 4096, 16384, 65536, 262144],
    labelNames: RPC_LABEL_NAMES,
  });

  public httpRpcResponsePayloadBytes = this.getOrCreateMetric('Histogram', {
    name: 'http_rpc_response_payload_bytes',
    help: 'Distribution of RPC response payload sizes',
    buckets: [256, 1024, 4096, 16384, 65536, 262144, 1048576],
    labelNames: RPC_LABEL_NAMES,
  });

  public ipfsRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'ipfs_requests_duration_seconds',
    help: 'IPFS gateway request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result', 'gateway'],
  });

  public ipfsOverallRequestDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'ipfs_overall_requests_duration_seconds',
    help: 'IPFS overall request duration',
    buckets: [0.1, 0.2, 0.3, 0.6, 1, 1.5, 2, 5, 10],
    labelNames: ['result', 'gateway'],
  });

  public dbQueryDuration = this.getOrCreateMetric('Histogram', {
    name: METRICS_PREFIX + 'db_query_duration_seconds',
    help: 'Duration of DB queries in seconds, labeled by operation, detail',
    buckets: [5, 10, 50, 100, 500, 1000, 2000], // ms
    labelNames: ['operation', 'detail'],
  });

  // Unfortunately, the current Logger API in TypeORM does not allow
  // to get both duration and error metrics in a single method.
  // So we have to use two separate metrics: dbQueryDuration and dbQueryCounter.
  public dbQueryCounter = this.getOrCreateMetric('Counter', {
    name: METRICS_PREFIX + 'db_query_counter',
    help: 'Total number of DB queries, labeled by operation, detail and status',
    labelNames: ['operation', 'detail', 'status'],
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
    labelNames: ['name', 'status'],
  });

  // TODO: TEMP - remove together with the ownership backfill.
  public ownershipBacklogGauge = this.getOrCreateMetric('Gauge', {
    name: METRICS_PREFIX + 'ownership_backlog',
    help: 'Vaults the ownership backfill has not resolved yet, labeled by what is missing. Expected to reach 0',
    labelNames: ['kind'],
  });
}
