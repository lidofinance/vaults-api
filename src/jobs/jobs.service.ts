import { Injectable, Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultJobsService } from './vault-jobs';

@Injectable()
export class JobsService {
  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultJobsService: VaultJobsService,
  ) {}
}
