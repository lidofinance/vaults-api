import { Injectable, Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService } from '../common/contracts/modules/vault-viewer-contract';
// import { VaultsService, VaultEntity } from '../vault';

@Injectable()
export class JobsService {
  // constructor(
  //   @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  //   private readonly vaultsService: VaultsService,
  // ) {}
  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
  ) {}

  public async initialize(): Promise<void> {
    console.log(1);
    const vaultHub = await this.vaultViewerContractService.getVaultHub();
    console.log('vaultHub:', vaultHub);
  }
}
