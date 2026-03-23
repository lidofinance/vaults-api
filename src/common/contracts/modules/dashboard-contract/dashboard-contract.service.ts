import { Contract } from 'ethers';

import { LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { DashboardAbi } from 'common/contracts/abi/Dashboard';

export type Overrides = { blockTag?: number | string };

const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)',
] as const;

export class DashboardContractService {
  public readonly contract: Contract;
  private readonly multicall3: Contract;

  constructor(
    private readonly provider: ExecutionProvider,
    private readonly dashboardAddress: string,
    private readonly multicall3Address: string,
    private readonly logger: LoggerService,
  ) {
    if (!dashboardAddress) {
      throw new Error('Dashboard contract address is not defined');
    }

    if (!multicall3Address) {
      throw new Error('Multicall3 contract address is not defined');
    }

    this.contract = new Contract(dashboardAddress, DashboardAbi, provider);
    this.multicall3 = new Contract(multicall3Address, MULTICALL3_ABI, provider);
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

  async getNOFeeSnapshot(overrides?: Overrides): Promise<{ settledGrowth: bigint; feeRate: bigint }> {
    const calls = [
      {
        target: this.address,
        allowFailure: false,
        callData: this.contract.interface.encodeFunctionData('settledGrowth'),
      },
      {
        target: this.address,
        allowFailure: false,
        callData: this.contract.interface.encodeFunctionData('feeRate'),
      },
    ];

    const results: Array<{ success: boolean; returnData: string }> = await this.multicall3.callStatic.aggregate3(
      calls,
      ...(overrides ? [overrides] : []),
    );

    const settledGrowth = BigInt(
      this.contract.interface.decodeFunctionResult('settledGrowth', results[0].returnData)[0].toString(),
    );

    const feeRate = BigInt(
      this.contract.interface.decodeFunctionResult('feeRate', results[1].returnData)[0].toString(),
    );

    return { settledGrowth, feeRate };
  }
}