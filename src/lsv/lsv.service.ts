import { Hex, Address } from 'viem';
import { Inject, Injectable } from '@nestjs/common';
import { iterateUrls } from '@lidofinance/rpc';

import { getVaultReport } from '@lidofinance/lsv-cli/dist/utils/report/report';
import { createPDGProof, ValidatorWitnessWithWC } from '@lidofinance/lsv-cli/dist/utils/proof/create-proof';
import { getReportProofByVault } from '@lidofinance/lsv-cli/dist/utils/report/report-proof';
import { type VaultReport as VaultReportCliType } from '@lidofinance/lsv-cli/dist/utils/report/types';
import { type Report } from '@lidofinance/lsv-cli/dist/utils/report';
import { calculateIPFSAddCID } from '@lidofinance/lsv-cli/dist/utils/ipfs';
import { calculateRebaseReward, type CalculateRebaseRewardArgs } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';
import { calculateHealth, type CalculateHealthArgs } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';
import { reportMetrics, type ReportMetricsArgs } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';
import { calcAccruedFeeOffChain } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';

import { PrometheusService } from 'common/prometheus';
import { RPC_NETWORK_NAME } from 'common/prometheus/prometheus.constants';
import { extractRpcErrorCode, normalizeRpcProvider } from 'common/prometheus/rpc-metrics.utils';
import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { sanitizeError } from 'common/errors';
import { ReportEntity, ReportLeafEntity } from 'db/report-db';
import { APP_USER_AGENT } from 'app/app.constants';

import { CalcAccruedFeeOffChainParams } from './lsv.types';

export const VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR = 'VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR';

export class ReportTooLargeError extends Error {}

@Injectable()
export class LsvService {
  constructor(
    protected readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  private async _createProof(
    validatorIndex: number,
    clApiUrl: string,
  ): Promise<ValidatorWitnessWithWC | typeof VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR> {
    const endTimer = this.prometheusService.clApiRequestDuration.startTimer();
    const startedAt = Date.now();
    const rpcLabels = {
      network: RPC_NETWORK_NAME,
      layer: 'cl',
      chain_id: String(this.configService.get('CHAIN_ID')),
      provider: normalizeRpcProvider(clApiUrl),
    };

    try {
      const proof = await createPDGProof(validatorIndex, clApiUrl);
      endTimer({ result: 'success' });
      this.observeClRpcMetrics(rpcLabels, 'createPDGProof', 'success', '', startedAt);
      return proof;
    } catch (error) {
      endTimer({ result: 'error' });

      if (error instanceof Error && error.message.startsWith(`ValidatorIndex ${validatorIndex} out of range`)) {
        this.observeClRpcMetrics(rpcLabels, 'createPDGProof', 'fail', '', startedAt);
        this.logger.warn(`[LsvService.createProof] Validator index ${validatorIndex} is out of range`);
        return VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR;
      }

      this.observeClRpcMetrics(rpcLabels, 'createPDGProof', 'fail', extractRpcErrorCode(error), startedAt);
      this.logger.error(
        `[LsvService.createProof] Failed to create PDG proof for validatorIndex ${validatorIndex}:`,
        sanitizeError(error),
      );
      throw error;
    }
  }

  // The RPC metrics policy set is recorded separately from `clApiRequestDuration` (which is
  // legacy). It is wrapped so a metrics bug never changes the outcome of the CL call itself.
  private observeClRpcMetrics(
    rpcLabels: { network: string; layer: string; chain_id: string; provider: string },
    method: string,
    result: 'success' | 'fail',
    rpcErrorCode: string,
    startedAt: number,
  ): void {
    try {
      this.prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
      this.prometheusService.httpRpcRequestsTotal.inc({
        ...rpcLabels,
        method,
        result,
        rpc_error_code: rpcErrorCode,
      });
    } catch (error) {
      this.logger.error('Failed to observe CL RPC metrics', { error });
    }
  }

  public async createProof(
    validatorIndex: number,
  ): Promise<ValidatorWitnessWithWC | typeof VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR> {
    return await iterateUrls(this.configService.clApiUrls, (url) => this._createProof(validatorIndex, url));
  }

  private getIpfsGatewayUrl(cid: string, gateway: string): string {
    return `${gateway.replace(/\/+$/, '')}/${cid}`;
  }

  private async fetchIPFSWithLimitAndVerify<T>(cid: string, gateway: string): Promise<T> {
    const maxBytes = this.configService.get('REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES');
    const timeoutMs = this.configService.get('REPORT_IPFS_FETCH_TIMEOUT_MS');
    const abortController = new AbortController();
    const timeout = timeoutMs
      ? setTimeout(() => abortController.abort(new Error(`IPFS fetch timeout after ${timeoutMs}ms`)), timeoutMs)
      : null;

    try {
      const response = await fetch(this.getIpfsGatewayUrl(cid, gateway), {
        signal: abortController.signal,
        headers: { 'User-Agent': `${APP_USER_AGENT}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS content: ${response.statusText}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = Number(contentLengthHeader);
        if (!Number.isFinite(contentLength)) {
          throw new Error(`IPFS GET response has invalid content-length=${contentLengthHeader}`);
        }
        if (maxBytes && contentLength > maxBytes) {
          throw new ReportTooLargeError(
            `IPFS report is too large (checked with content-length): contentLength=${contentLength}, maxBytes=${maxBytes}`,
          );
        }
      }

      if (!response.body) {
        throw new Error('IPFS GET response is missing body');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          receivedBytes += value.byteLength;
          if (maxBytes && receivedBytes > maxBytes) {
            await reader.cancel();
            throw new ReportTooLargeError(
              `IPFS report is too large (checked with streaming): receivedBytes=${receivedBytes}, maxBytes=${maxBytes}`,
            );
          }

          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const fileContent = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        fileContent.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const calculatedCID = await calculateIPFSAddCID(fileContent);
      if (calculatedCID.toString() !== cid) {
        throw new Error(`File hash mismatch! Expected ${cid}, but got ${calculatedCID}`);
      }

      return JSON.parse(new TextDecoder().decode(fileContent));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async _fetchIPFS(cid: string, gateway: string): Promise<Report> {
    const endTimer = this.prometheusService.ipfsRequestDuration.startTimer();
    try {
      const report = await this.fetchIPFSWithLimitAndVerify<Report>(cid, gateway);
      endTimer({ result: 'success', gateway });
      return report;
    } catch (error) {
      endTimer({ result: 'error', gateway });
      this.logger.error(`[LsvService._fetchIPFS] Failed to fetch IPFS report (cid: ${cid}): ${error.message}`);
      throw error;
    }
  }

  public async fetchIPFS(cid: string): Promise<Report> {
    const endOverallTimer = this.prometheusService.ipfsOverallRequestDuration.startTimer();
    let lastError: Error | null = null;
    let lastGateway: string | undefined;

    try {
      for (const gateway of this.configService.ipfsGateways) {
        lastGateway = gateway;
        try {
          const report = await this._fetchIPFS(cid, gateway);
          endOverallTimer({ result: 'success' });
          return report;
        } catch (error) {
          lastError = error;
          if (error instanceof ReportTooLargeError) break;
        }
      }

      throw lastError ?? new Error('All IPFS gateways failed');
    } catch (error) {
      endOverallTimer({ result: 'error', gateway: lastGateway });
      this.logger.error(`[LsvService.fetchIPFS] All IPFS gateways failed for cid=${cid}: ${error.message}`);
      throw error;
    }
  }

  private async _getVaultReport(vault: Address, cid: string, gateway: string): Promise<VaultReportCliType> {
    const endTimer = this.prometheusService.ipfsRequestDuration.startTimer();
    try {
      const report = await getVaultReport(
        {
          vault,
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
      endTimer({ result: 'success', gateway });
      return report;
    } catch (error) {
      endTimer({ result: 'error', gateway });
      this.logger.error(
        `[LsvService._getVaultReport] Failed to get vault report (vault: ${vault}, cid: ${cid}): ${error.message}`,
      );
      throw error;
    }
  }

  public async getVaultReport(vault: Address, cid: string): Promise<VaultReportCliType> {
    const endOverallTimer = this.prometheusService.ipfsOverallRequestDuration.startTimer();
    let lastGateway: string | undefined;

    try {
      const report = await iterateUrls(this.configService.ipfsGateways, (url) => {
        lastGateway = url;
        return this._getVaultReport(vault, cid, url);
      });
      endOverallTimer({ result: 'success' });
      return report;
    } catch (error) {
      endOverallTimer({ result: 'error', gateway: lastGateway });
      this.logger.error(`[LsvService.getVaultReport] All IPFS gateways failed for cid=${cid}: ${error.message}`);
      throw error;
    }
  }

  private async _getReportProofByVault(
    vault: Address,
    cid: string,
    gateway: string,
  ): Promise<(VaultReportCliType & { proof: Hex[] }) | null> {
    const endTimer = this.prometheusService.ipfsRequestDuration.startTimer();
    try {
      const report = await getReportProofByVault(
        {
          vault,
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
      endTimer({ result: 'success', gateway });
      return report;
    } catch (error) {
      // This is the behavior of the CLI
      if (error.message?.toLowerCase().includes(`vault ${vault.toLowerCase()} not found in report`)) {
        endTimer({ result: 'not_found', gateway });
        this.logger.warn(`[LsvService._getReportProofByVault] ${error.message}`);
        return null;
      }

      endTimer({ result: 'error', gateway });
      this.logger.error(
        `[LsvService._getReportProofByVault] Failed to get vault report and proof (vault: ${vault}, cid: ${cid}): ${error.message}`,
      );
      throw error;
    }
  }

  public async getReportProofByVault(
    vault: Address,
    cid: string,
  ): Promise<(VaultReportCliType & { proof: Hex[] }) | null> {
    const endOverallTimer = this.prometheusService.ipfsOverallRequestDuration.startTimer();
    let lastGateway: string | undefined;

    try {
      const report = await iterateUrls(this.configService.ipfsGateways, (url) => {
        lastGateway = url;
        return this._getReportProofByVault(vault, cid, url);
      });
      endOverallTimer({ result: report === null ? 'not_found' : 'success' });
      return report;
    } catch (error) {
      endOverallTimer({ result: 'error', gateway: lastGateway });
      this.logger.error(`[LsvService.getReportProofByVault] All IPFS gateways failed for cid=${cid}: ${error.message}`);
      throw error;
    }
  }

  public async calculateHealth(args: CalculateHealthArgs): Promise<ReturnType<typeof calculateHealth>> {
    return calculateHealth({ ...args });
  }

  public async calculateRebaseReward(args: CalculateRebaseRewardArgs): Promise<bigint> {
    return calculateRebaseReward({ ...args });
  }

  public async calcReportMetrics(args: ReportMetricsArgs): Promise<ReturnType<typeof reportMetrics>> {
    return reportMetrics({ ...args });
  }

  public calcAccruedFeeOffChain(params: CalcAccruedFeeOffChainParams): bigint {
    return calcAccruedFeeOffChain(params);
  }

  public static transformToVaultReportCli(report: ReportEntity, leaf: ReportLeafEntity): VaultReportCliType {
    return {
      data: {
        vaultAddress: leaf.vaultAddress,
        totalValueWei: leaf.totalValueWei,
        fee: leaf.fee,
        liabilityShares: leaf.liabilityShares,
        maxLiabilityShares: leaf.maxLiabilityShares,
        slashingReserve: leaf.slashingReserve,
      },
      extraData: {
        inOutDelta: leaf.inOutDelta,
        prevFee: leaf.prevFee,
        infraFee: leaf.infraFee,
        liquidityFee: leaf.liquidityFee,
        reservationFee: leaf.reservationFee,
      },
      leaf: report.tree[leaf.treeIndex],
      refSlot: report.refSlot,
      blockNumber: report.blockNumber,
      timestamp: report.timestamp,
      prevTreeCID: report.prevTreeCID,
      cid: report.cid,
    };
  }
}
