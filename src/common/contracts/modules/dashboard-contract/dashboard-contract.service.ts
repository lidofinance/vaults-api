import { Contract } from 'ethers';

import { LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { DashboardAbi } from 'common/contracts/abi/Dashboard';

export type Overrides = { blockTag?: number | string };

export class DashboardContractService {
  public readonly contract: Contract;

  constructor(
    private readonly provider: ExecutionProvider,
    private readonly dashboardAddress: string,
    private readonly logger: LoggerService,
  ) {
    if (!dashboardAddress) {
      throw new Error('Dashboard contract address is not defined');
    }

    this.contract = new Contract(dashboardAddress, DashboardAbi, provider);
  }

  get address(): string {
    return this.dashboardAddress;
  }

  async getSettledGrowth(overrides?: Overrides): Promise<bigint> {
    const value = await this.contract.callStatic.settledGrowth(...(overrides ? [overrides] : []));
    return BigInt(value);
  }

  async getFeeRate(overrides?: Overrides): Promise<bigint> {
    const value = await this.contract.callStatic.feeRate(...(overrides ? [overrides] : []));
    return BigInt(value);
  }
}
