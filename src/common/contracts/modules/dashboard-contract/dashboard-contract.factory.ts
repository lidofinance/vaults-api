import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { DashboardContractService } from './dashboard-contract.service';

@Injectable()
export class DashboardContractFactory {
  private readonly services = new Map<string, DashboardContractService>();

  constructor(
    private readonly provider: ExecutionProvider,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  get(dashboardAddress: string): DashboardContractService {
    if (!dashboardAddress) {
      throw new Error('Dashboard address is not defined');
    }

    const key = dashboardAddress.toLowerCase();

    const existing = this.services.get(key);
    if (existing) return existing;

    const created = new DashboardContractService(this.provider, dashboardAddress, this.logger);

    this.services.set(key, created);
    return created;
  }
}
