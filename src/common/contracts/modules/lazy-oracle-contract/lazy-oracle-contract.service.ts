import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { LazyOracleAbi } from '../../abi/LazyOracle';

export type LatestReportData = {
  timestamp: bigint;
  refSlot: bigint;
  treeRoot: string;
  reportCid: string;
};

@Injectable()
export class LazyOracleContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
    if (!address) throw new Error('LazyOracle contract address is not defined');
    this.contract = new Contract(address, LazyOracleAbi, provider);
  }

  async getLatestReportData(): Promise<LatestReportData> {
    const [timestamp, refSlot, treeRoot, reportCid] = await this.contract.latestReportData();

    return {
      // BigNumber to bigint
      timestamp: BigInt(timestamp),
      refSlot: BigInt(refSlot),
      treeRoot,
      reportCid,
    };
  }
}
