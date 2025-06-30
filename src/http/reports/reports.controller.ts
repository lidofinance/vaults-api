import { Controller, Get, Param, Version } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ConfigService } from 'common/config';
import { LsvService } from 'lsv';

import { ReportParamsDto } from './dto';
import { reportByVaultExample } from './example';

@Controller('report')
@ApiTags('Reports')
export class ReportsController {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    private readonly lsvService: LsvService,
    private readonly lazyOracleContractService: LazyOracleContractService,
  ) {}

  @Version('1')
  @Get('/last/:vaultAddress')
  @ApiResponse({
    status: 200,
    description: 'Last report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  async getLast(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await this.lsvService.fetchAndVerifyFile(latestReportData.reportCid);
    } catch (error) {
      this.logger.error(`Failed to verify report CID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    const vaultReport = await this.lsvService.getVaultReport({
      vault,
      cid: latestReportData.reportCid,
      gateway: this.configService.get('IPFS_GATEWAY'),
    });
    const reportProof = await this.lsvService.getVaultReportProofByCid({
      vault,
      cid: vaultReport.proofsCID,
      gateway: this.configService.get('IPFS_GATEWAY'),
    });

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await this.lsvService.fetchAndVerifyFile(vaultReport.proofsCID);
    } catch (error) {
      this.logger.error(`Failed to verify report proofsCID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    // TODO: response can be changed
    return {
      vaultReport,
      reportProof,
    };
  }

  @Version('1')
  @Get('/previous/:vaultAddress')
  @ApiResponse({
    status: 200,
    description: 'Previous report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  async getPrevious(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    const lastVaultReport = await this.lsvService.getVaultReport({
      vault,
      cid: latestReportData.reportCid,
      gateway: this.configService.get('IPFS_GATEWAY'),
    });
    if (!lastVaultReport.prevTreeCID) {
      throw new BadRequestException(`Previous report CID not found in the latest report`);
    }

    const prevVaultReport = await this.lsvService.getVaultReport({
      vault,
      cid: lastVaultReport.prevTreeCID,
      gateway: this.configService.get('IPFS_GATEWAY'),
    });

    const reportProof = await this.lsvService.getVaultReportProofByCid({
      vault,
      cid: prevVaultReport.proofsCID,
      gateway: this.configService.get('IPFS_GATEWAY'),
    });

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await this.lsvService.fetchAndVerifyFile(prevVaultReport.proofsCID);
    } catch (error) {
      this.logger.error(`Failed to verify report proofsCID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    // TODO: response can be changed
    return {
      vaultReport: prevVaultReport,
      reportProof,
    };
  }
}
