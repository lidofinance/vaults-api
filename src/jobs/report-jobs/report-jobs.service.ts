import fetch from 'node-fetch';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { ReportService } from 'report';

@Injectable()
export class ReportJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly reportService: ReportService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportJobsService initialization started');
    // ...
    this.logger.log('VaultJobsService initialization finished');
  }

  async fetchReportFromIPFS(cid: string): Promise<any> {
    // TODO: env
    const url = `https://ipfs.io/ipfs/${cid}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch IPFS report: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  async fetchAllReports(): Promise<void> {
    let cid: string | null = (await this.vaultHubContractService.getLatestReportData()).reportCid;

    while (cid) {
      try {
        const reportData = await this.fetchReportFromIPFS(cid);
        console.log(`Fetched report for CID: ${cid}`);

        const report = await this.reportService.saveReport(cid, reportData);
        console.log(`Saved the report for CID: ${cid}`);

        await this.reportService.saveLeaves(report, reportData.values || []);
        console.log(`Saved leaves for CID: ${cid}`);

        cid = reportData.prevTreeCID && reportData.prevTreeCID.trim() !== '' ? reportData.prevTreeCID : null;
      } catch (error) {
        console.error(`Failed to fetch/save report with CID: ${cid}`, error);
        return;
      }
    }

    console.log(`Report fetching complete!`);
  }
}
