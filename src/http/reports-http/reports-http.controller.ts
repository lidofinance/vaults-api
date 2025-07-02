import { Controller, Get, Param, Version, HttpStatus } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ErrorResponseType } from 'http/common/dto/error-response-type';
import { ConfigService } from 'common/config';
import { LsvService } from 'lsv';

import { ReportParamsDto } from './dto';
import { reportByVaultExample } from './example';

@Controller('report')
@ApiTags('Reports')
export class ReportsHttpController {
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
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault by address not exist or failed to verify report!',
    type: ErrorResponseType,
  })
  async getLast(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await this.lsvService.fetchAndVerifyFile(latestReportData.reportCid);
    } catch (error) {
      this.logger.error(`Failed to verify report CID ${latestReportData.reportCid}: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    try {
      // vault report and proof
      return await this.lsvService.getReportProofByVault({
        vault,
        cid: latestReportData.reportCid,
        gateway: this.configService.get('IPFS_GATEWAY'),
      });
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);
      throw new BadRequestException(`Vault by address not exist!`);
    }
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
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault by address not exist or previous report CID not found!',
    type: ErrorResponseType,
  })
  async getPrevious(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    let latestVaultReport;
    try {
      latestVaultReport = await this.lsvService.getVaultReport({
        vault,
        cid: latestReportData.reportCid,
        gateway: this.configService.get('IPFS_GATEWAY'),
      });
    } catch (error) {
      this.logger.error(`Failed to getVaultReport ${vault}: ${error.message}`);
      throw new BadRequestException(`Vault by address not exist!`);
    }
    if (!latestVaultReport.prevTreeCID) {
      this.logger.warn(`Previous report CID not found in the latest report, cid = ${latestReportData.reportCid}`);
      throw new BadRequestException(`Previous report CID not found in the latest report`);
    }

    try {
      // vault prev report and proof
      return await this.lsvService.getReportProofByVault({
        vault,
        cid: latestVaultReport.prevTreeCID,
        gateway: this.configService.get('IPFS_GATEWAY'),
      });
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);
      throw new BadRequestException(`Vault by address not exist!`);
    }
  }
}
