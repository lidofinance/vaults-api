import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { ConfigService } from 'common/config';
import { MULTICALL3_CONTRACT } from 'common/contracts/contracts.constants';
import { DashboardContractService } from './dashboard-contract.service';

@Injectable()
export class DashboardContractFactory {
  private readonly services = new Map<string, DashboardContractService>();

  constructor(
    private readonly configService: ConfigService,
    private readonly provider: ExecutionProvider,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  get(dashboardAddress: string): DashboardContractService {
    if (!dashboardAddress) {
      throw new Error('Dashboard address is not defined');
    }

    const addressMap = this.configService.getCustomConfigContractsAddressMap();
    const multicall3Address = addressMap?.get(MULTICALL3_CONTRACT);

    const key = dashboardAddress.toLowerCase();

    const existing = this.services.get(key);
    if (existing) return existing;

    const created = new DashboardContractService(this.provider, dashboardAddress, multicall3Address, this.logger);

    this.services.set(key, created);
    return created;
  }
}
