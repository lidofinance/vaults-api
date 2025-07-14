import { Controller, Get, Param, Version, HttpStatus } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ErrorResponseType } from 'http/common/dto/error-response-type';
import { ConfigService } from 'common/config';
import { LsvService } from 'lsv';

import { ReportByVaultParamsDto, ReportByCidAndVaultParamsDto } from './dto';
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
  @Get('/:cid/:vaultAddress')
  @CacheTTL(120 * 1000)
  @ApiResponse({
    status: 200,
    description: 'Report data by CID for a vaultAddress',
    schema: {
      example: reportByVaultExample,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Report found by CID, but the vault address is not present in it.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'cid must match /^[Qm][1-9A-HJ-NP-Za-km-z]{44,}$/ regular expression',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'vaultAddress must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Report by CID not exist or failed to verify report!',
    type: ErrorResponseType,
  })
  async getReportByCidAndVault(@Param() params: ReportByCidAndVaultParamsDto) {
    const cid = params.cid;
    const vault = params.vaultAddress;

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await this.lsvService.fetchAndVerifyFile(cid);
    } catch (error) {
      this.logger.error(`Failed to verify report CID ${cid}: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    try {
      // vault report and proof
      return await this.lsvService.getReportProofByVault({
        vault,
        cid,
        gateway: this.configService.get('IPFS_GATEWAY'),
      });
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);

      if (error.message?.toLowerCase().includes(`vault ${vault.toLowerCase()} not found in report`)) {
        return null;
      }

      throw new BadRequestException(`Report by CID not exist!`);
    }
  }

  @Version('1')
  @Get('/last/:vaultAddress')
  @CacheTTL(120 * 1000)
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
  async getLast(@Param() params: ReportByVaultParamsDto) {
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
      throw new BadRequestException(`Vault by address not exist or failed to verify report!`);
    }
  }

  @Version('1')
  @Get('/previous/:vaultAddress')
  @CacheTTL(120 * 1000)
  @ApiResponse({
    status: 200,
    description: 'Previous report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault by address not exist or failed to verify report or previous report CID not found!',
    type: ErrorResponseType,
  })
  async getPrevious(@Param() params: ReportByVaultParamsDto) {
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
      throw new BadRequestException(`Vault by address not exist or failed to verify report!`);
    }
  }
}
