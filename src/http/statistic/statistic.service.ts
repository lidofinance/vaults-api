import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { LidoLocator, LIDO_LOCATOR_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { Statistic } from './entities';

@Injectable()
export class StatisticService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    @Inject(LIDO_LOCATOR_CONTRACT_TOKEN) protected readonly lidoLocatorContract: LidoLocator,
  ) {}

  statistic(): Statistic {
    this.logger.log('Statistic');

    return {
      timestamp: Number(new Date()),
      lidoLocatorContract: this.lidoLocatorContract.address,
    };
  }
}
