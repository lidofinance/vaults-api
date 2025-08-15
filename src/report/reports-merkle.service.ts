import { Address, Hex } from 'viem';
import { LRUCache } from 'lru-cache';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getVaultData, type Report } from '@lidofinance/lsv-cli/dist/utils/report';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { LsvService } from 'lsv';

// Estimated size in MB for 10,000 vaults:
// - IPFSReportData ≈ 4.36 MB
// - merkleTree ≈ 2.51 MB
// - indexByVaultMap ≈ 0.46 MB
// Total ≈ 7.3 MB
// Calculated for IPFS CID: QmfVbCvPxvZsfuSH1dNbtpbs6XLWszQ6nZ9EkujvLjNDco
// with https://www.npmjs.com/package/object-sizeof
type CachedTree = {
  IPFSReportData: Report;
  merkleTree: StandardMerkleTree<any>;
  indexByVaultMap: Map<string, number>;
};

@Injectable()
export class ReportsMerkleService {
  private readonly cache: LRUCache<string, CachedTree>;

  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly lsvService: LsvService,
    private readonly configService: ConfigService,
  ) {
    this.cache = new LRUCache<string, CachedTree>({
      max: configService.get('REPORT_MERKLE_TREE_CACHE_MAX'),
      // https://isaacs.github.io/node-lru-cache/interfaces/LRUCache.OptionsBase.html#ttl
      ttl: 0, // no time-based expiration, eviction only when max is exceeded
    });
  }

  async getReportProofByVault(
    vault: Address,
    cid: string,
  ): Promise<{ proof: Hex[] } & ReturnType<typeof getVaultData>> {
    const { IPFSReportData, merkleTree, indexByVaultMap } = await this.getOrBuildMerkleTree(cid);

    const vaultIndex = indexByVaultMap.get(vault.toLowerCase());
    if (vaultIndex === undefined) {
      throw new NotFoundException(`Vault ${vault} not found in report ${cid}`);
    }

    const vaultReportData = getVaultData(IPFSReportData, vault);

    return {
      ...vaultReportData,
      proof: merkleTree.getProof(vaultIndex) as Hex[],
    };
  }

  private async getOrBuildMerkleTree(cid: string): Promise<CachedTree> {
    const cached = this.cache.get(cid);
    if (cached) {
      return cached;
    }

    const IPFSReportData = await this.lsvService.fetchIPFS(cid);

    const merkleTree = StandardMerkleTree.load({
      ...IPFSReportData,
      values: IPFSReportData.values.map(({ treeIndex, value }) => ({
        value,
        treeIndex: Number(treeIndex),
      })),
    });

    // Build Map(address -> treeIndex) for O(1) vault index lookup
    const indexByVaultMap = new Map<string, number>();
    IPFSReportData.values.forEach(({ value }, idx) => {
      const vaultAddress = String(value[0]).toLowerCase();
      if (!indexByVaultMap.has(vaultAddress)) indexByVaultMap.set(vaultAddress, idx);
    });

    const packed: CachedTree = { IPFSReportData, merkleTree, indexByVaultMap };
    this.cache.set(cid, packed);
    return packed;
  }
}
