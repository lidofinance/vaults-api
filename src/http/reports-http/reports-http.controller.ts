import { Controller, Get, Param, Version, HttpStatus } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotFoundException } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ConfigService } from 'common/config';
import { VaultDbService } from 'db/vault-db/vault-db.service';
import { LsvService } from 'lsv';
import { ReportsMerkleService } from 'report/reports-merkle.service';
import { ErrorResponseType } from 'http/common/dto/error-response-type';

import { ReportByVaultParamsDto, ReportByCidAndVaultParamsDto } from './dto';
import { reportByVaultExample } from './example';

@Controller('report')
@ApiTags('Reports')
export class ReportsHttpController {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    private readonly vaultDbService: VaultDbService,
    private readonly lsvService: LsvService,
    private readonly lazyOracleContractService: LazyOracleContractService,
    private readonly reportsMerkleService: ReportsMerkleService,
  ) {}

  @Version('1')
  @Get('/:cid/:vaultAddress')
  @CacheTTL(120 * 1000)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report data by CID for a vaultAddress',
    schema: {
      example: reportByVaultExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report found by CID, but the vault address is not present in it.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report not found by CID or failed to verify report.',
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
    status: HttpStatus.NOT_FOUND,
    description: 'Vault not exist',
    type: ErrorResponseType,
  })
  async getReportByCidAndVault(@Param() params: ReportByCidAndVaultParamsDto) {
    const cid = params.cid;
    const vault = params.vaultAddress;

    await this.assertVaultExists(vault);

    try {
      // vault report and proof
      const report = await this.reportsMerkleService.getReportProofByVault(vault, cid);
      return { report };
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);
      return { report: null };
    }
  }

  @Version('1')
  @Get('/last/:vaultAddress')
  @CacheTTL(120 * 1000)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Last report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report found by CID, but the vault address is not present in it.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report not found by CID or failed to verify report.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'vaultAddress must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vault not exist',
    type: ErrorResponseType,
  })
  async getLast(@Param() params: ReportByVaultParamsDto) {
    const vault = params.vaultAddress;

    await this.assertVaultExists(vault);

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    try {
      // vault report and proof
      const report = await this.lsvService.getReportProofByVault(vault, latestReportData.reportCid);
      return { report };
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);
      return { report: null };
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
    status: HttpStatus.OK,
    description: 'Report found by CID, but the vault address is not present in it.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report not found by CID or failed to verify report.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Previous report CID is not exist.',
    schema: {
      example: null,
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vault not exist',
    type: ErrorResponseType,
  })
  async getPrevious(@Param() params: ReportByVaultParamsDto) {
    const vault = params.vaultAddress;

    await this.assertVaultExists(vault);

    const latestReportData = await this.lazyOracleContractService.getLatestReportData();

    let latestVaultReport;
    try {
      latestVaultReport = await this.lsvService.getVaultReport(vault, latestReportData.reportCid);
    } catch (error) {
      this.logger.error(`Failed to getVaultReport ${vault}: ${error.message}`);
      return { report: null };
    }
    if (!latestVaultReport.prevTreeCID) {
      this.logger.warn(`Previous report CID not found in the latest report, cid = ${latestReportData.reportCid}`);
      return { report: null };
    }

    try {
      // vault prev report and proof
      const report = await this.lsvService.getReportProofByVault(vault, latestVaultReport.prevTreeCID);
      return { report };
    } catch (error) {
      this.logger.error(`Failed to getReportProofByVault ${vault}: ${error.message}`);
      return { report: null };
    }
  }

  private async assertVaultExists(vaultAddress: string): Promise<void> {
    const exists = await this.vaultDbService.existsVaultByAddress(vaultAddress);
    if (!exists) {
      throw new NotFoundException(`Vault with address=${vaultAddress} not found`);
    }
  }
}
