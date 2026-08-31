import { utils } from 'ethers';
import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { StakingVaultAbi } from 'common/contracts/abi/StakingVault';
import { StakingVaultContractService } from './staking-vault-contract.service';

const stakingVaultInterface = new utils.Interface(StakingVaultAbi);
const OWNERSHIP_TRANSFERRED_TOPIC = stakingVaultInterface.getEventTopic('OwnershipTransferred');

export type OwnershipTransferredLog = {
  vault: string;
  previousOwner: string;
  newOwner: string;
  blockNumber: number;
  logIndex: number;
};

@Injectable()
export class StakingVaultContractFactory {
  private readonly services = new Map<string, StakingVaultContractService>();

  constructor(
    private readonly provider: ExecutionProvider,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  /**
   * All `OwnershipTransferred` logs in the block range, chain-wide. The topic is the standard OZ
   * `Ownable` event, so most of the result belongs to unrelated contracts and the caller filters by
   * the vault addresses it cares about. One topic-only `eth_getLogs` is used instead of address
   * filters because ethers v5 does not accept an address array in a filter, and per-vault filters
   * would be one RPC call per vault again.
   */
  async getOwnershipTransferredLogs(fromBlock: number, toBlock: number): Promise<OwnershipTransferredLog[]> {
    const logs = await this.provider.getLogs({ fromBlock, toBlock, topics: [OWNERSHIP_TRANSFERRED_TOPIC] });

    return (
      logs
        // The topic hash does not encode which args are indexed: a contract emitting
        // `OwnershipTransferred(address,address)` with non-indexed args shares it, but carries the
        // owners in `data` and would not survive `parseLog` below.
        .filter((log) => log.topics.length === 3)
        .map((log) => {
          const parsed = stakingVaultInterface.parseLog(log);
          return {
            vault: log.address,
            previousOwner: String(parsed.args.previousOwner),
            newOwner: String(parsed.args.newOwner),
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
          };
        })
    );
  }

  get(stakingVaultAddress: string): StakingVaultContractService {
    if (!stakingVaultAddress) {
      throw new Error('StakingVault address is not defined');
    }

    const key = stakingVaultAddress.toLowerCase();

    const existing = this.services.get(key);
    if (existing) return existing;

    const created = new StakingVaultContractService(this.provider, stakingVaultAddress, this.logger);

    this.services.set(key, created);
    return created;
  }
}
